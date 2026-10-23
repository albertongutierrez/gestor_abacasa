<?php

namespace App\Services;

use App\Models\Account;
use App\Models\LedgerEntry;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LedgerService
{
    public static function minor(string|int|float $value): int
    {
        return (int) bcmul((string) $value, '100', 0);
    }

    public static function roundedMinor(string $value): int
    {
        return (int) bcadd(bcmul($value, '100', 6), '0.5', 0);
    }

    public static function signed(LedgerEntry $e): int
    {
        return $e->kind === 'debit' ? -$e->amount_minor : $e->amount_minor;
    }

    private function persist(LedgerEntry $entry, array $values, User $user): LedgerEntry
    {
        $before = $entry->exists ? $entry->getAttributes() : null;
        $entry->fill($values);
        if ($entry->exists) {
            $entry->version++;
        }
        $entry->save();
        DB::table('ledger_audits')->insert(['entry_id' => $entry->id, 'user_id' => $user->id,
            'before' => $before ? json_encode($before) : null, 'after' => json_encode($entry->getAttributes()), 'created_at' => now()]);

        return $entry;
    }

    public function cancelPurchase(Account $account, LedgerEntry $entry, int $version, User $user): void
    {
        abort_unless($user->canDo('ledger.purchase.update'), 403);
        DB::transaction(function () use ($account, $entry, $version, $user) {
            DB::table('offices')->where('id', $account->office_id)->lockForUpdate()->first();
            $entry = $account->entries()->whereKey($entry->id)->where('kind', 'purchase')->lockForUpdate()->firstOrFail();
            if (!empty($entry->details['cancelled_at'])) return;
            if ($entry->version !== $version) {
                throw ValidationException::withMessages(['version' => 'La compra cambió. Recarga antes de cancelarla.']);
            }
            $this->persist($entry, ['amount_minor' => 0, 'details' => [
                ...$entry->details, 'original_amount_minor' => $entry->amount_minor,
                'cancelled_at' => now()->toIso8601String(), 'cancelled_by' => $user->id,
            ]], $user);
            app(PurchaseSettlementService::class)->assertValid($account);
        });
    }

    public function cancelCredit(Account $account, LedgerEntry $entry, int $version, User $user): void
    {
        abort_unless($user->canDo('ledger.credit.update'), 403);
        DB::transaction(function () use ($account, $entry, $version, $user) {
            DB::table('offices')->where('id', $account->office_id)->lockForUpdate()->first();
            $entry = $account->entries()->whereKey($entry->id)->where('kind', 'credit')->whereNull('source_id')->lockForUpdate()->firstOrFail();
            if (!empty($entry->details['cancelled_at'])) return;
            if ($entry->version !== $version) {
                throw ValidationException::withMessages(['version' => 'El crédito cambió. Recarga antes de cancelarlo.']);
            }
            $this->persist($entry, ['amount_minor' => 0, 'details' => [
                ...($entry->details ?? []), 'original_amount_minor' => $entry->amount_minor,
                'cancelled_at' => now()->toIso8601String(), 'cancelled_by' => $user->id,
            ]], $user);
        }, 3);
    }

    public function cancelDebit(Account $account, LedgerEntry $entry, int $version, User $user): void
    {
        abort_unless($user->canDo('ledger.debit.update'), 403);
        DB::transaction(function () use ($account, $entry, $version, $user) {
            DB::table('offices')->where('id', $account->office_id)->lockForUpdate()->first();
            $entry = $account->entries()->whereKey($entry->id)->where('kind', 'debit')->whereNull('source_id')->lockForUpdate()->firstOrFail();
            if (!empty($entry->details['cancelled_at'])) return;
            if ($entry->version !== $version) {
                throw ValidationException::withMessages(['version' => 'El débito cambió. Recarga antes de cancelarlo.']);
            }
            $children = $entry->children()->lockForUpdate()->get();
            if ($children->contains(fn ($child) => $child->kind === 'credit' && $child->amount_minor > 0)) {
                abort_unless($user->canDo('ledger.credit.update'), 403);
            }
            foreach ($children->prepend($entry) as $movement) {
                $this->persist($movement, ['amount_minor' => 0, 'details' => [
                    ...($movement->details ?? []), 'original_amount_minor' => $movement->amount_minor,
                    'cancelled_at' => now()->toIso8601String(), 'cancelled_by' => $user->id,
                ]], $user);
            }
            app(PurchaseSettlementService::class)->assertValid($account);
            foreach ($children->where('kind', 'credit') as $child) app(PurchaseSettlementService::class)->assertValid($child->account);
        }, 3);
    }

    public function save(Account $account, array $data, User $user, ?LedgerEntry $entry = null): LedgerEntry
    {
        return DB::transaction(function () use ($account, $data, $user, $entry) {
            // Serialize all writers in the company, including transfers, in a stable lock order.
            DB::table('offices')->where('id', $account->office_id)->lockForUpdate()->first();
            $entry = $entry ? LedgerEntry::whereKey($entry->id)->lockForUpdate()->firstOrFail() : new LedgerEntry;
            if ($entry->exists && !empty($entry->details['cancelled_at'])) {
                throw ValidationException::withMessages(['version' => 'No puedes editar un movimiento cancelado.']);
            }
            if ($entry->exists && ($entry->source_id || (int) ($data['version'] ?? 0) !== $entry->version)) {
                throw ValidationException::withMessages(['version' => 'El movimiento cambió o es vinculado. Recarga y edita el movimiento de origen.']);
            }
            if ($entry->exists && $entry->kind !== $data['kind']) {
                throw ValidationException::withMessages(['kind' => 'No puedes cambiar el tipo de un movimiento existente.']);
            }
            $ability = $entry->exists ? 'update' : 'create';
            abort_unless($user->canDo('ledger.'.$data['kind'].'.'.$ability), 403);
            $currency = $data['currency'];
            $details = [];
            $amount = self::minor($data['amount'] ?? '0');
            $settlements = app(PurchaseSettlementService::class);
            $productPayment = $data['kind'] === 'debit' && $currency === 'USD' && $settlements->enabled($account);
            $used = self::minor($data['credit_used'] ?? '0');
            $applied = 0;
            if (!$productPayment && $used) {
                throw ValidationException::withMessages(['credit_used' => 'El saldo disponible se aplica únicamente a compras V2 en dólares.']);
            }
            if ($productPayment) {
                if (empty($data['settlement_month']) || !in_array($data['product'] ?? null, ['Maíz', 'Soya'], true)) {
                    throw ValidationException::withMessages(['settlement_month' => 'Selecciona el mes y el producto al que corresponde este pago.']);
                }
                $context = $settlements->summary($account, $data['date'], $entry->exists ? $entry : null);
                $group = collect($context['groups'])->first(fn ($g) => $g['month'] === $data['settlement_month'] && $g['product'] === $data['product']);
                $pending = $group['pending_minor'] ?? 0;
                if ($used > $context['available_minor'] || $used > $pending) {
                    throw ValidationException::withMessages(['credit_used' => 'El saldo a utilizar no puede superar el disponible ni el pendiente del mes y producto.']);
                }
                $applied = $used + min($amount, max(0, $pending - $used));
            }
            if ($data['kind'] === 'purchase') {
                if (count($data['items']) !== 1) {
                    throw ValidationException::withMessages(['items' => 'La compra V2 permite un solo producto: maíz o soya.']);
                }
                $currency = 'USD';
                $amount = 0;
                foreach ($data['items'] as $i => $item) {
                    $line = self::roundedMinor(bcmul($item['quantity'], $item['price'], 8)) - self::minor($item['discount']);
                    if ($line <= 0) {
                        throw ValidationException::withMessages(["items.$i.discount" => 'El total de la línea debe ser mayor que cero.']);
                    }
                    $amount += $line;
                }
                $quantity = (string) $data['items'][0]['quantity'];
                $transport = self::roundedMinor(bcmul($quantity, (string) $data['transport_price'], 12));
                $cost = self::roundedMinor(bcmul(bcdiv((string) $amount, '100', 2), $data['exchange_rate'], 8)) + $transport;
                $details = ['settlement_month' => $data['settlement_month'] ?? substr($data['date'], 0, 7),
                    'items' => $data['items'], 'exchange_rate' => $data['exchange_rate'],
                    'transport_price' => $data['transport_price'], 'transport_quantity' => $quantity,
                    'transport' => bcdiv((string) $transport, '100', 2), 'cost_minor' => $cost];
            }
            if (($amount <= 0 && !($productPayment && $used > 0 && $amount === 0)) || $amount > 99999999999) {
                throw ValidationException::withMessages(['amount' => 'Monto fuera del rango permitido.']);
            }
            $children = $entry->exists ? $entry->children()->get() : collect();
            $oldLink = $children->firstWhere('kind', 'credit');
            $linked = $data['kind'] === 'debit' && $data['linked'];
            if ($linked || ($oldLink && $oldLink->amount_minor > 0)) {
                abort_unless($user->canDo('ledger.credit.'.($oldLink ? 'update' : 'create')), 403);
            }
            $target = null;
            $linkedAmount = 0;
            if ($linked) {
                if ($amount <= 0) throw ValidationException::withMessages(['linked' => 'El crédito vinculado necesita dinero nuevo; no se crea con saldo reutilizado.']);
                $target = Account::where('office_id', $account->office_id)->where('public_id', $data['linked_account'])->firstOrFail();
                if ($target->id === $account->id) {
                    throw ValidationException::withMessages(['linked_account' => 'Elige un proveedor diferente.']);
                }
                $linkedAmount = $data['linked_mode'] === 'full' ? $amount : self::minor($data['linked_amount']);
                if ($linkedAmount > $amount) {
                    throw ValidationException::withMessages(['linked_amount' => 'El crédito no puede superar el débito.']);
                }
            }
            if ($data['kind'] === 'debit') {
                $details = ['excess' => $data['excess'], 'linked' => (bool) $linked, 'linked_account' => $target?->public_id,
                    'linked_mode' => $linked ? $data['linked_mode'] : 'full', 'linked_amount' => $linked ? bcdiv((string) $linkedAmount, '100', 2) : '', 'linked_comment' => $data['linked_comment'] ?? ''];
                if ($productPayment) $details = [...$details, 'settlement_month' => $data['settlement_month'], 'product' => $data['product'],
                    'credit_used_minor' => $used, 'applied_minor' => $applied];
            }
            $entry = $this->persist($entry, ['account_id' => $account->id, 'created_by' => $entry->created_by ?? $user->id,
                'kind' => $data['kind'], 'currency' => $currency, 'date' => $data['date'], 'amount_minor' => $amount,
                'comment' => $data['comment'] ?? null, 'reference' => $data['reference'] ?? null, 'details' => $details], $user);
            if ($linked || $oldLink) {
                $this->persist($oldLink ?? new LedgerEntry, ['account_id' => $target?->id ?? $oldLink->account_id, 'created_by' => $oldLink?->created_by ?? $user->id,
                    'source_id' => $entry->id, 'kind' => 'credit', 'currency' => $currency, 'date' => $data['date'], 'amount_minor' => $linkedAmount,
                    'comment' => $data['linked_comment'] ?? '', 'reference' => 'Débito vinculado', 'details' => null], $user);
            }
            // A return is a recorded cash event. Recompute only this debit's return when editing it.
            $refund = $children->firstWhere('kind', 'refund');
            $refundAmount = 0;
            if ($data['kind'] === 'debit' && $data['excess'] === 'refund') {
                $prior = $account->entries()->where('currency', $currency)->where('id', '!=', $entry->id)
                    ->where(fn ($q) => $q->whereNull('source_id')->orWhere('source_id', '!=', $entry->id))
                    ->where(fn ($q) => $q->where('date', '<', $entry->date)->orWhere(fn ($q) => $q->where('date', $entry->date)->where('id', '<', $entry->id)))
                    ->get()->sum(fn ($e) => self::signed($e));
                $refundAmount = $productPayment ? $amount - ($applied - $used) : max(0, $amount - max(0, $prior));
            }
            if ($refund || $refundAmount) {
                $this->persist($refund ?? new LedgerEntry, ['account_id' => $account->id, 'created_by' => $refund?->created_by ?? $user->id,
                    'source_id' => $entry->id, 'kind' => 'refund', 'currency' => $currency, 'date' => $data['date'], 'amount_minor' => $refundAmount,
                    'comment' => 'Devolución del excedente del abono', 'details' => null], $user);
            }

            $settlements->assertValid($account);
            if ($target) $settlements->assertValid($target);
            if ($oldLink && (!$target || $oldLink->account_id !== $target->id)) $settlements->assertValid($oldLink->account);

            return $entry;
        }, 3);
    }

    public function statement(Account $account, string $from, string $to): array
    {
        $entries = $account->entries()->with(['source.account', 'children'])->orderBy('date')->orderBy('id')->get();
        $result = [];
        foreach (['USD', 'DOP'] as $currency) {
            $all = $entries->where('currency', $currency);
            $opening = $all->where('date', '<', $from)->sum(fn ($e) => self::signed($e));
            $balance = $opening;
            $debit = 0;
            $credit = 0;
            $rows = [];
            foreach ($all->where('date', '>=', $from)->where('date', '<=', $to) as $e) {
                if (! $e->amount_minor && (empty($e->details['applied_minor']) || !empty($e->details['cancelled_at']))) {
                    continue;
                }
                $balance += self::signed($e);
                $debit += $e->kind === 'debit' ? $e->amount_minor : 0;
                $credit += $e->kind !== 'debit' ? $e->amount_minor : 0;
                $rows[] = ['id' => $e->public_id, 'kind' => $e->kind, 'currency' => $e->currency, 'date' => $e->date,
                    'amount_minor' => $e->amount_minor, 'comment' => $e->comment, 'reference' => $e->reference,
                    'details' => $e->details, 'version' => $e->version, 'balance' => $balance,
                    'source_account' => $e->source?->account->public_id, 'source_date' => $e->source?->date, 'source_id' => $e->source?->public_id];
            }
            $result[$currency] = ['opening' => $opening, 'closing' => $balance, 'debit' => $debit, 'credit' => $credit,
                'current' => $all->sum(fn ($e) => self::signed($e)), 'rows' => $rows];
        }

        return $result;
    }
}
