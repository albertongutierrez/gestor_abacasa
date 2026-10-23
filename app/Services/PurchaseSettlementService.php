<?php

namespace App\Services;

use App\Models\Account;
use App\Models\LedgerEntry;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

/** Product allocations do not create cash entries or convert currencies. */
class PurchaseSettlementService
{
    public function enabled(Account $account): bool
    {
        return $account->entries()->where('kind', 'purchase')->exists();
    }

    public static function month(LedgerEntry $entry): ?string
    {
        return $entry->details['settlement_month'] ?? ($entry->kind === 'purchase' ? substr($entry->date, 0, 7) : null);
    }

    public static function product(LedgerEntry $entry): ?string
    {
        return $entry->kind === 'purchase' ? ($entry->details['items'][0]['product'] ?? null) : ($entry->details['product'] ?? null);
    }

    public function summary(Account $account, ?string $date = null, ?LedgerEntry $editing = null, bool $strict = false): array
    {
        $query = $account->entries()->where('currency', 'USD')->orderBy('date')->orderBy('id');
        if ($date) {
            $query->where(fn ($q) => $q->where('date', '<', $date)->orWhere(function ($q) use ($date, $editing) {
                $q->where('date', $date);
                if ($editing) $q->where('id', '<', $editing->id);
            }));
        }
        if ($editing) {
            $query->whereKeyNot($editing->id)->where(fn ($q) => $q->whereNull('source_id')->orWhere('source_id', '!=', $editing->id));
        }

        return $this->calculate($query->get(), $strict);
    }

    public function assertValid(Account $account): void
    {
        $this->summary($account, strict: true);
    }

    private function calculate(Collection $entries, bool $strict): array
    {
        $free = 0;
        $groups = [];
        foreach ($entries as $entry) {
            $details = $entry->details ?? [];
            if (!empty($details['cancelled_at'])) continue;
            $month = self::month($entry);
            $product = self::product($entry);
            $assigned = $month && in_array($product, ['Maíz', 'Soya'], true);
            $key = $month.'|'.$product;
            if ($assigned && in_array($entry->kind, ['purchase', 'debit'], true)) {
                $groups[$key] ??= ['month' => $month, 'product' => $product, 'purchases_minor' => 0,
                    'applied_minor' => 0, 'pending_minor' => 0, 'quantity' => 0, 'rows' => []];
            }
            if ($entry->kind === 'purchase') {
                if (!$assigned) continue;
                $groups[$key]['purchases_minor'] += $entry->amount_minor;
                $groups[$key]['quantity'] += (float) ($details['items'][0]['quantity'] ?? 0);
            } elseif ($entry->kind === 'debit') {
                $applied = $assigned ? (int) ($details['applied_minor'] ?? 0) : 0;
                $used = $assigned ? (int) ($details['credit_used_minor'] ?? 0) : 0;
                if ($strict && ($used < 0 || $used > max(0, $free))) {
                    throw ValidationException::withMessages(['credit_used' => 'El saldo disponible cambió o ya se utilizó en otro pago. Recarga los balances. Para corregir un pago anterior, corrige primero sus aplicaciones posteriores.']);
                }
                if ($strict && $assigned && ($applied < $used || $applied > $entry->amount_minor + $used ||
                    $applied > $groups[$key]['purchases_minor'] - $groups[$key]['applied_minor'])) {
                    throw ValidationException::withMessages(['settlement_month' => 'Este cambio dejaría pagos sin compras suficientes en ese mes y producto. Corrige o cancela primero esos pagos.']);
                }
                $free += $entry->amount_minor - $applied;
                if ($assigned) $groups[$key]['applied_minor'] += $applied;
            } else {
                // Ordinary credits and actual refunds consume unassigned funds.
                $free -= $entry->amount_minor;
            }
            if ($assigned && in_array($entry->kind, ['purchase', 'debit'], true) && ($entry->amount_minor || !empty($details['applied_minor']))) {
                $groups[$key]['rows'][] = ['id' => $entry->public_id, 'kind' => $entry->kind, 'date' => $entry->date,
                    'currency' => 'USD', 'amount_minor' => $entry->amount_minor, 'reference' => $entry->reference,
                    'comment' => $entry->comment, 'details' => $details, 'version' => $entry->version,
                    'balance' => $groups[$key]['purchases_minor'] - $groups[$key]['applied_minor'],
                    'source_id' => null, 'source_account' => null, 'source_date' => null];
            }
        }
        foreach ($groups as &$group) $group['pending_minor'] = $group['purchases_minor'] - $group['applied_minor'];
        unset($group);
        $groups = array_values($groups);
        usort($groups, fn ($a, $b) => strcmp($b['month'], $a['month']) ?: strcmp($a['product'], $b['product']));

        return ['available_minor' => max(0, $free), 'general_pending_minor' => max(0, -$free),
            'pending_minor' => array_sum(array_column($groups, 'pending_minor')), 'groups' => $groups];
    }
}
