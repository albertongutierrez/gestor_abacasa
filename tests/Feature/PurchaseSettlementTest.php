<?php

namespace Tests\Feature;

use App\Models\{Account, BranchOffice, LedgerEntry, Office, Role, User};
use App\Services\{LedgerService, PurchaseSettlementService};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PurchaseSettlementTest extends TestCase
{
    use RefreshDatabase;

    private Account $account;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->seed();
        $office = Office::create(['name' => 'Empresa', 'is_active' => true]);
        $branch = BranchOffice::create(['office_id' => $office->id, 'name' => 'Principal', 'code' => 'P', 'is_active' => true]);
        $this->user = User::factory()->create(['active_branch_office_id' => $branch->id]);
        $this->user->roles()->attach(Role::where('slug', 'admin')->first(), ['office_id' => $office->id]);
        $this->account = Account::create(['office_id' => $office->id, 'name' => 'Cuenta V2']);
        $this->actingAs($this->user);
    }

    private function data(array $override = []): array
    {
        return array_replace(['kind' => 'debit', 'currency' => 'USD', 'date' => '2026-10-10', 'amount' => '100.00',
            'linked' => false, 'excess' => 'keep', 'items' => [], 'settlement_month' => '2026-10', 'product' => 'Maíz', 'credit_used' => '0'], $override);
    }

    private function purchase(array $override = []): array
    {
        return $this->data(array_replace(['kind' => 'purchase', 'date' => '2026-10-01', 'exchange_rate' => '60', 'transport_price' => '0',
            'items' => [['product' => 'Maíz', 'unit' => 'quintal', 'quantity' => '10', 'price' => '10', 'discount' => '0']]], $override));
    }

    private function save(array $data): LedgerEntry
    {
        return app(LedgerService::class)->save($this->account, $data, $this->user);
    }

    private function postMovement(array $data)
    {
        return $this->postJson(route('ledger.store', $this->account->public_id), $data);
    }

    private function summary(): array
    {
        return app(PurchaseSettlementService::class)->summary($this->account);
    }

    public function test_month_is_required_and_independent_of_purchase_date(): void
    {
        $this->postMovement($this->purchase(['settlement_month' => null]))->assertUnprocessable()->assertJsonValidationErrors('settlement_month');
        $this->postMovement($this->purchase(['settlement_month' => '2026-13']))->assertUnprocessable();
        $this->postMovement($this->purchase(['settlement_month' => '2026-09']))->assertCreated();
        $entry = LedgerEntry::first();
        $this->assertSame('2026-09', $entry->details['settlement_month']);
        $this->getJson(route('ledger.index', ['account' => $this->account->public_id]))->assertOk()
            ->assertJsonPath('accounts.0.uses_purchases', true)->assertJsonPath('settlement.groups.0.month', '2026-09');
        $this->getJson(route('ledger.purchases.show', $entry->public_id))->assertOk()->assertJsonPath('purchase.details.settlement_month', '2026-09');
    }

    public function test_prior_credit_remains_available_until_explicitly_applied_without_double_debit(): void
    {
        $this->save($this->data(['date' => '2026-09-01', 'amount' => '50']));
        $this->save($this->purchase());
        $this->assertSame(5000, $this->summary()['available_minor']);
        $this->assertSame(10000, $this->summary()['pending_minor']);
        $this->postMovement($this->data(['amount' => '0', 'credit_used' => '50']))->assertCreated();
        $this->assertSame(0, $this->summary()['available_minor']);
        $this->assertSame(5000, $this->summary()['pending_minor']);
        $s = app(LedgerService::class)->statement($this->account, '2026-09-01', '2026-10-31')['USD'];
        $this->assertSame(5000, $s['debit']);
        $this->assertSame(5000, $s['closing']);
        $this->assertCount(3, $s['rows']);
        $this->assertSame(5000, $s['rows'][2]['details']['applied_minor']);
        $this->assertSame(0, $s['rows'][2]['amount_minor']);
    }

    public function test_cash_and_credit_form_one_payment_and_excess_is_not_applied_to_another_product(): void
    {
        $this->save($this->purchase());
        $this->save($this->data(['amount' => '150']));
        $this->save($this->purchase(['date' => '2026-10-11', 'settlement_month' => '2026-11',
            'items' => [['product' => 'Soya', 'unit' => 'quintal', 'quantity' => '10', 'price' => '10', 'discount' => '0']]]));
        $s = $this->summary();
        $this->assertSame(5000, $s['available_minor']);
        $this->assertSame(10000, $s['pending_minor']);
        $this->postMovement($this->data(['date' => '2026-10-12', 'settlement_month' => '2026-11', 'product' => 'Soya', 'amount' => '20', 'credit_used' => '50']))->assertCreated();
        $payment = LedgerEntry::latest('id')->first();
        $this->assertSame(2000, $payment->amount_minor);
        $this->assertSame(7000, $payment->details['applied_minor']);
        $this->assertSame(5000, $payment->details['credit_used_minor']);
        $this->assertSame(0, $this->summary()['available_minor']);
        $this->assertSame(3000, $this->summary()['pending_minor']);
        $this->assertSame(3000, app(LedgerService::class)->statement($this->account, '2026-10-01', '2026-10-31')['USD']['current']);
    }

    public function test_editing_and_cancelling_payments_cannot_remove_credit_already_spent(): void
    {
        $advance = $this->save($this->data(['date' => '2026-09-01', 'amount' => '50']));
        $purchase = $this->save($this->purchase());
        $payment = $this->save($this->data(['amount' => '0', 'credit_used' => '50']));
        $this->postJson(route('ledger.debits.cancel', $advance->public_id), ['version' => 1])->assertUnprocessable();
        $this->assertSame(5000, $advance->fresh()->amount_minor);
        $this->postJson(route('ledger.purchases.cancel', $purchase->public_id), ['version' => 1])->assertUnprocessable();
        $this->putJson(route('ledger.update', ['account' => $this->account->public_id, 'entry' => $purchase->public_id]),
            $this->purchase(['version' => 1, 'settlement_month' => '2026-11']))->assertUnprocessable();
        $this->postJson(route('ledger.debits.cancel', $payment->public_id), ['version' => 1])->assertOk();
        $this->assertSame(5000, $this->summary()['available_minor']);
        $this->assertSame(10000, $this->summary()['pending_minor']);
        $this->postJson(route('ledger.debits.cancel', $advance->public_id), ['version' => 1])->assertOk();
        $this->assertSame(0, $this->summary()['available_minor']);
    }

    public function test_month_product_available_credit_and_backdated_usage_are_validated(): void
    {
        $this->save($this->data(['date' => '2026-09-01', 'amount' => '50']));
        $this->save($this->purchase());
        $this->postMovement($this->data(['product' => null]))->assertUnprocessable()->assertJsonValidationErrors('settlement_month');
        $this->postMovement($this->data(['credit_used' => '51']))->assertUnprocessable()->assertJsonValidationErrors('credit_used');
        $this->postMovement($this->data(['date' => '2026-08-01', 'credit_used' => '1']))->assertUnprocessable();
        $this->postMovement($this->data(['product' => 'Soya', 'credit_used' => '1']))->assertUnprocessable();
        $this->postMovement($this->data(['amount' => '0', 'credit_used' => '40']))->assertCreated();
        $this->postMovement($this->data(['amount' => '0', 'credit_used' => '40']))->assertUnprocessable();
        $this->assertSame(1000, $this->summary()['available_minor']);
        $this->assertSame(6000, $this->summary()['pending_minor']);
        $this->assertDatabaseCount('ledger_entries', 3);
    }

    public function test_refund_is_only_new_cash_excess_and_linked_credit_uses_only_new_cash(): void
    {
        $this->save($this->data(['date' => '2026-09-01', 'amount' => '50']));
        $this->save($this->purchase());
        $target = Account::create(['office_id' => $this->account->office_id, 'name' => 'Destino']);
        $payment = $this->save($this->data(['amount' => '100', 'credit_used' => '50', 'excess' => 'refund', 'linked' => true,
            'linked_account' => $target->public_id, 'linked_mode' => 'full']));
        $this->assertSame(5000, $payment->children()->where('kind', 'refund')->first()->amount_minor);
        $this->assertSame(10000, $payment->children()->where('kind', 'credit')->first()->amount_minor);
        $this->assertSame(0, $this->summary()['available_minor']);
        $this->assertSame(0, $this->summary()['pending_minor']);
    }

    public function test_legacy_rows_are_not_guessed_and_context_is_company_and_date_scoped(): void
    {
        $purchase = $this->save($this->purchase());
        $details = $purchase->details;
        unset($details['settlement_month']);
        $purchase->update(['details' => $details]);
        $legacy = $this->save($this->data(['currency' => 'DOP', 'amount' => '900']));
        // Legacy USD debits have cash but no product allocation metadata.
        $legacy->update(['currency' => 'USD', 'amount_minor' => 5000, 'details' => ['excess' => 'keep']]);
        $this->assertSame('2026-10', $this->summary()['groups'][0]['month']);
        $this->assertSame(5000, $this->summary()['available_minor']);
        $this->assertSame(10000, $this->summary()['pending_minor']);
        $url = route('ledger.payment-context', $this->account->public_id);
        $this->getJson($url.'?date=2026-10-09')->assertOk()->assertJsonPath('available_minor', 0);
        $this->getJson($url.'?date=2026-10-11')->assertOk()->assertJsonPath('available_minor', 5000);
        $this->getJson($url.'?date=2026-10-11&entry='.$legacy->public_id)->assertOk()->assertJsonPath('available_minor', 0);
        $other = Account::create(['office_id' => Office::create(['name' => 'Otra', 'is_active' => true])->id, 'name' => 'Privada']);
        $this->getJson(route('ledger.payment-context', $other->public_id).'?date=2026-10-11')->assertNotFound();
        $this->getJson($url.'?date=2026-10-11', ['X-Ledger-Branch' => 'wrong'])->assertConflict();
        $this->user->roles()->detach();
        $this->user->unsetRelation('roles');
        $this->getJson($url.'?date=2026-10-11')->assertForbidden();
    }

    public function test_pesos_do_not_fund_dollar_allocations_and_ordinary_accounts_are_unchanged(): void
    {
        $this->postMovement($this->data(['amount' => '75']))->assertCreated();
        $this->assertSame(-7500, app(LedgerService::class)->statement($this->account, '2026-10-01', '2026-10-31')['USD']['current']);
        $this->getJson(route('ledger.index', ['account' => $this->account->public_id]))->assertOk()->assertJsonPath('settlement', null);
        $this->save($this->purchase());
        $this->save($this->data(['currency' => 'DOP', 'amount' => '900']));
        $this->assertSame(7500, $this->summary()['available_minor']);
        $this->postMovement($this->data(['currency' => 'DOP', 'credit_used' => '1']))->assertUnprocessable();
    }

    public function test_payment_correction_moves_allocation_and_restores_available_funds(): void
    {
        $this->save($this->purchase());
        $this->save($this->purchase(['settlement_month' => '2026-11']));
        $payment = $this->save($this->data(['amount' => '150']));
        $this->assertSame(5000, $this->summary()['available_minor']);
        $url = route('ledger.update', ['account' => $this->account->public_id, 'entry' => $payment->public_id]);
        $this->putJson($url, $this->data(['version' => 1, 'amount' => '75', 'settlement_month' => '2026-11']))->assertOk();
        $summary = $this->summary();
        $this->assertSame(0, $summary['available_minor']);
        $this->assertSame(12500, $summary['pending_minor']);
        $this->assertSame(7500, collect($summary['groups'])->firstWhere('month', '2026-11')['applied_minor']);
        $this->assertSame(0, collect($summary['groups'])->firstWhere('month', '2026-10')['applied_minor']);
        $this->putJson($url, $this->data(['version' => 1]))->assertUnprocessable()->assertJsonValidationErrors('version');
        $this->assertDatabaseCount('ledger_entries', 3);
        $this->assertDatabaseHas('ledger_audits', ['entry_id' => $payment->id]);
    }

    public function test_pdf_includes_month_product_and_separates_available_from_cash_debits(): void
    {
        $this->save($this->data(['date' => '2026-09-01', 'amount' => '50']));
        $purchase = $this->save($this->purchase(['settlement_month' => '2026-09']));
        $this->save($this->data(['amount' => '10', 'credit_used' => '30', 'settlement_month' => '2026-09']));
        $html = view('ledger.statement', ['account' => $this->account, 'filters' => ['from' => '2026-09-01', 'to' => '2026-10-31'],
            'issuer' => ['name' => 'ABACASA', 'lines' => []], 'logoData' => '', 'settlement' => $this->summary(),
            'statement' => app(LedgerService::class)->statement($this->account, '2026-09-01', '2026-10-31')])->render();
        $this->assertStringContainsString('septiembre 2026', $html);
        $this->assertStringContainsString('Saldo disponible sin aplicar', $html);
        $this->assertStringContainsString('Saldo utilizado: 30.00', $html);
        $this->assertStringContainsString('Aplicado: 40.00', $html);
        $this->get(route('ledger.print', ['account' => $this->account->public_id, 'period' => 'custom', 'from' => '2026-09-01', 'to' => '2026-10-31']))->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->get(route('ledger.purchases.print', $purchase->public_id))->assertOk()->assertHeader('Content-Type', 'application/pdf');
    }
}
