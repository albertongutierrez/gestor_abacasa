<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\BranchOffice;
use App\Models\LedgerEntry;
use App\Models\Office;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use App\Services\LedgerService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class LedgerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    private Account $account;

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutVite();
        $this->seed();
        $office = Office::create(['name' => 'A', 'is_active' => true]);
        $branch = BranchOffice::create(['office_id' => $office->id, 'name' => 'Principal', 'code' => 'P', 'is_active' => true]);
        $this->admin = User::factory()->create(['active_branch_office_id' => $branch->id]);
        $this->admin->roles()->attach(Role::where('slug', 'admin')->first(), ['office_id' => $office->id]);
        $this->account = Account::create(['office_id' => $office->id, 'name' => 'Proveedor']);
        $this->actingAs($this->admin);
    }

    private function data(array $overrides = []): array
    {
        return array_replace(['kind' => 'credit', 'currency' => 'USD', 'date' => '2026-10-10', 'amount' => '100.00', 'comment' => 'Prueba', 'linked' => false, 'excess' => 'keep', 'items' => [], 'settlement_month' => '2026-10', 'product' => 'Maíz', 'credit_used' => '0'], $overrides);
    }

    private function postEntry(array $data, ?Account $account = null)
    {
        return $this->post(route('ledger.store', ($account ?? $this->account)->public_id), $data);
    }

    private function updateEntry(LedgerEntry $e, array $data)
    {
        return $this->put(route('ledger.update', ['account' => $e->account->public_id, 'entry' => $e->public_id]), $data);
    }

    private function statement(string $from = '2026-10-01', string $to = '2026-10-31'): array
    {
        return app(LedgerService::class)->statement($this->account, $from, $to);
    }

    public function test_dashboard_scopes_balances_and_month_activity(): void
    {
        $this->travelTo(\Carbon\Carbon::parse('2026-10-19 12:00:00'));
        $service = app(LedgerService::class);
        $service->save($this->account, $this->data(['date' => '2026-09-01']), $this->admin);
        $service->save($this->account, $this->data(['kind' => 'debit', 'amount' => '150']), $this->admin);
        $service->save($this->account, $this->data(['currency' => 'DOP', 'amount' => '200']), $this->admin);
        $service->save($this->account, $this->data(['date' => '2026-11-01', 'amount' => '999']), $this->admin);
        $office = Office::create(['name' => 'Otra', 'is_active' => true]);
        $other = Account::create(['office_id' => $office->id, 'name' => 'Privada']);
        $service->save($other, $this->data(['amount' => '9999']), $this->admin);
        $this->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Dashboard')->where('summary.accounts', 1)
            ->where('summary.currencies.USD.pending', 0)->where('summary.currencies.USD.favor', 5000)
            ->where('summary.currencies.USD.debits', 15000)->where('summary.currencies.USD.credits', 0)
            ->where('summary.currencies.DOP.pending', 20000)->has('summary.recent', 3)
            ->has('summary.top.USD', 0)->has('summary.top.DOP', 1)
            ->has('summary.history', 12)->where('summary.history.0.month', '2025-11')
            ->where('summary.history.0.USD.credits', 0)
            ->where('summary.history.10.USD.credits', 10000)
            ->where('summary.history.11.month', '2026-10')
            ->where('summary.history.11.USD.debits', 15000)
            ->where('summary.history.11.DOP.credits', 20000));
        $this->admin->roles()->detach();
        $this->admin->unsetRelation('roles');
        $this->get(route('dashboard'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('summary', null));
        $this->travelBack();
    }

    public function test_credit_cancellation_preserves_history_and_rejects_linked_credits(): void
    {
        $service = app(LedgerService::class);
        $entry = $service->save($this->account, $this->data(), $this->admin)->fresh();
        $url = route('ledger.credits.cancel', $entry->public_id);
        $this->postJson($url, ['version' => 99])->assertUnprocessable();
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        $this->assertEquals(0, $entry->fresh()->amount_minor);
        $this->assertEquals(10000, $entry->fresh()->details['original_amount_minor']);
        $this->assertDatabaseHas('ledger_audits', ['entry_id' => $entry->id]);
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        $this->assertEquals(2, $entry->fresh()->version);
        $this->updateEntry($entry->fresh(), $this->data(['version' => 2]))->assertSessionHasErrors('version');
        $target = Account::create(['office_id' => $this->account->office_id, 'name' => 'Destino']);
        $debit = $service->save($this->account, $this->data(['kind' => 'debit', 'linked' => true,
            'linked_account' => $target->public_id, 'linked_mode' => 'full']), $this->admin);
        $child = $debit->children()->first();
        $this->postJson(route('ledger.credits.cancel', $child->public_id), ['version' => 1])->assertNotFound();
        $this->assertEquals(10000, $child->fresh()->amount_minor);
        $this->admin->roles()->detach();
        $this->admin->unsetRelation('roles');
        $this->postJson($url, ['version' => 2])->assertForbidden();
    }

    public function test_debit_cancellation_reverses_linked_entries_and_preserves_audit(): void
    {
        $target = Account::create(['office_id' => $this->account->office_id, 'name' => 'Destino']);
        $service = app(LedgerService::class);
        $entry = $service->save($this->account, $this->data([
            'kind' => 'debit', 'linked' => true, 'linked_account' => $target->public_id,
            'linked_mode' => 'full', 'excess' => 'refund',
        ]), $this->admin);
        $entry->refresh();
        $url = route('ledger.debits.cancel', $entry->public_id);
        $this->postJson($url, ['version' => 99])->assertUnprocessable();
        $this->assertEquals(10000, $entry->fresh()->amount_minor);
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        foreach ([$entry->fresh(), ...$entry->children()->get()] as $movement) {
            $this->assertEquals(0, $movement->amount_minor);
            $this->assertNotEmpty($movement->details['cancelled_at']);
            $this->assertEquals(10000, $movement->details['original_amount_minor']);
            $this->assertDatabaseHas('ledger_audits', ['entry_id' => $movement->id]);
        }
        $this->assertEquals(0, $service->statement($target, '2026-10-01', '2026-10-31')['USD']['closing']);
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        $this->assertEquals(2, $entry->fresh()->version);
        $this->updateEntry($entry->fresh(), $this->data(['kind' => 'debit', 'version' => 2]))->assertSessionHasErrors('version');
    }

    public function test_statement_pdf_supports_multiple_pages(): void
    {
        for ($i = 1; $i <= 90; $i++) {
            app(LedgerService::class)->save($this->account, $this->data(['comment' => "Movimiento {$i}"]), $this->admin);
        }
        $response = $this->get(route('ledger.print', ['account' => $this->account->public_id, 'period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31']))
            ->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertGreaterThan(1, preg_match_all('~/Type\s*/Page\b~', $response->getContent()));
    }

    public function test_statement_template_only_shows_currencies_with_activity_or_opening_balance(): void
    {
        $render = fn () => view('ledger.statement', [
            'account' => $this->account,
            'issuer' => ['name' => 'Empresa', 'lines' => []], 'logoData' => '',
            'filters' => ['from' => '2026-10-01', 'to' => '2026-10-31'],
            'statement' => $this->statement(),
        ])->render();
        $this->assertStringNotContainsString('<h2>Dólares estadounidenses</h2>', $render());
        $this->assertStringNotContainsString('<h2>Pesos dominicanos</h2>', $render());
        $this->postEntry($this->data())->assertSessionHasNoErrors();
        $this->assertStringContainsString('<h2>Dólares estadounidenses</h2>', $render());
        $this->assertStringNotContainsString('<h2>Pesos dominicanos</h2>', $render());
        $this->postEntry($this->data(['currency' => 'DOP', 'date' => '2026-09-10']))->assertSessionHasNoErrors();
        $this->assertStringContainsString('<h2>Pesos dominicanos</h2>', $render());
        $this->postEntry($this->data(['currency' => 'DOP', 'date' => '2026-09-11', 'kind' => 'debit']))->assertSessionHasNoErrors();
        $this->assertStringNotContainsString('<h2>Pesos dominicanos</h2>', $render());
        $this->postEntry($this->data(['currency' => 'DOP', 'date' => '2026-09-12', 'kind' => 'debit']))->assertSessionHasNoErrors();
        $this->assertStringContainsString('<h2>Pesos dominicanos</h2>', $render());
        // A zero closing balance must not hide activity during the selected period.
        $this->postEntry($this->data(['kind' => 'debit']))->assertSessionHasNoErrors();
        $this->assertStringContainsString('<h2>Dólares estadounidenses</h2>', $render());
        $other = Account::create(['office_id' => $this->account->office_id, 'name' => 'Solo pesos']);
        $this->postEntry($this->data(['currency' => 'DOP']), $other)->assertSessionHasNoErrors();
        $this->account = $other;
        $this->assertStringContainsString('<h2>Pesos dominicanos</h2>', $render());
        $this->assertStringNotContainsString('<h2>Dólares estadounidenses</h2>', $render());
    }

    public function test_purchase_view_filters_and_isolates_company_accounts(): void
    {
        $purchase = $this->data(['kind' => 'purchase', 'exchange_rate' => '60', 'transport_price' => '50',
            'items' => [['product' => 'Maíz', 'unit' => 'quintal', 'quantity' => '100', 'price' => '20', 'discount' => '0']]]);
        $this->postEntry($purchase)->assertSessionHasNoErrors();
        $this->postEntry($this->data())->assertSessionHasNoErrors();
        $params = ['period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31'];
        $this->getJson(route('ledger.purchases', $params))->assertOk()
            ->assertJsonPath('purchases.total', 1)->assertJsonPath('total', 200000)
            ->assertJsonPath('purchases.data.0.details.cost_minor', 12500000);
        $other = Office::create(['name' => 'Other', 'is_active' => true]);
        $account = Account::create(['office_id' => $other->id, 'name' => 'Private']);
        $this->getJson(route('ledger.purchases', [...$params, 'account' => $account->public_id]))->assertNotFound();
        $this->getJson(route('ledger.purchases', [...$params, 'from' => '2026-11-01', 'to' => '2026-11-30']))
            ->assertOk()->assertJsonPath('purchases.total', 0);
        $user = User::factory()->create(['active_branch_office_id' => $this->admin->active_branch_office_id]);
        $this->actingAs($user)->getJson(route('ledger.purchases', $params))->assertForbidden();
    }

    public function test_purchase_show_is_scoped_and_rejects_other_movement_types(): void
    {
        $this->postEntry($this->data(['kind' => 'purchase', 'exchange_rate' => '58.50', 'transport_price' => '0',
            'items' => [['product' => 'Maíz', 'unit' => 'quintal', 'quantity' => '755', 'price' => '12.90', 'discount' => '0']]]))->assertSessionHasNoErrors();
        $entry = $this->account->entries()->firstOrFail();
        $url = route('ledger.purchases.show', $entry->public_id);
        $printUrl = route('ledger.purchases.print', $entry->public_id);
        $pdfResponse = $this->get($printUrl)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $pdfResponse->getContent());
        $this->assertStringContainsString('inline', $pdfResponse->headers->get('Content-Disposition'));
        $this->get($printUrl.'?download=1')->assertOk()->assertDownload('compra-v2-'.$entry->public_id.'.pdf');
        $this->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page->component('Ledger/PurchaseShow')
            ->where('purchase.id', $entry->public_id)->where('purchase.details.cost_minor', 56976075));
        $this->getJson($url)->assertOk()->assertJsonPath('account.id', $this->account->public_id)->assertJsonPath('issuer.name', 'A');
        $this->postEntry($this->data())->assertSessionHasNoErrors();
        $credit = $this->account->entries()->where('kind', 'credit')->firstOrFail();
        $this->get(route('ledger.purchases.show', $credit->public_id))->assertNotFound();
        $other = Office::create(['name' => 'Other', 'is_active' => true]);
        $this->account->update(['office_id' => $other->id]);
        $this->get($url)->assertNotFound();
        $this->get($printUrl)->assertNotFound();
        $user = User::factory()->create(['active_branch_office_id' => $this->admin->active_branch_office_id]);
        $this->actingAs($user)->get($url)->assertForbidden();
        $this->get($printUrl)->assertForbidden();
    }

    public function test_purchase_cancellation_removes_balance_and_preserves_audit(): void
    {
        $data = $this->data(['kind' => 'purchase', 'exchange_rate' => '60', 'transport_price' => '0',
            'items' => [['product' => 'Maíz', 'unit' => 'quintal', 'quantity' => '100', 'price' => '20', 'discount' => '0']]]);
        $this->postEntry($data)->assertSessionHasNoErrors();
        $entry = $this->account->entries()->firstOrFail();
        $url = route('ledger.purchases.cancel', $entry->public_id);
        $this->postJson($url, ['version' => 99])->assertUnprocessable();
        $this->assertSame(200000, $entry->fresh()->amount_minor);
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        $entry->refresh();
        $this->assertSame(0, $entry->amount_minor);
        $this->assertSame(200000, $entry->details['original_amount_minor']);
        $this->assertNotEmpty($entry->details['cancelled_at']);
        $this->assertSame(0, $this->statement()['USD']['current']);
        $this->assertDatabaseCount('ledger_audits', 2);
        $this->postJson($url, ['version' => $entry->version])->assertOk();
        $this->assertDatabaseCount('ledger_audits', 2);
        $this->putJson(route('ledger.update', ['account' => $this->account->public_id, 'entry' => $entry->public_id]), [...$data, 'version' => $entry->version])->assertUnprocessable();
        $other = Office::create(['name' => 'Other', 'is_active' => true]);
        $this->account->update(['office_id' => $other->id]);
        $this->postJson($url, ['version' => $entry->version])->assertNotFound();
        $user = User::factory()->create(['active_branch_office_id' => $this->admin->active_branch_office_id]);
        $this->actingAs($user)->postJson($url, ['version' => $entry->version])->assertForbidden();
    }

    public function test_currencies_and_opening_balance_are_independent(): void
    {
        $this->get(route('ledger.index'))->assertOk()->assertInertia(fn (Assert $page) => $page
            ->component('Ledger/Index')->where('selected', null)->where('statement', null)->has('accounts', 1));
        $this->postEntry($this->data(['date' => '2026-09-01']))->assertSessionHasNoErrors();
        $this->postEntry($this->data(['currency' => 'DOP', 'amount' => '7000']))->assertSessionHasNoErrors();
        $this->postEntry($this->data(['kind' => 'debit', 'amount' => '120.25']))->assertSessionHasNoErrors();
        $s = $this->statement();
        $this->assertSame(10000, $s['USD']['opening']);
        $this->assertSame(-2025, $s['USD']['closing']);
        $this->assertSame(700000, $s['DOP']['closing']);
        $this->get(route('ledger.index', ['account' => $this->account->public_id, 'period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31']))->assertOk()->assertInertia(fn (Assert $page) => $page->component('Ledger/Index')->where('statement.USD.opening', 10000)->etc());
        $url = route('ledger.print', ['account' => $this->account->public_id]);
        $response = $this->get($url)->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $response->getContent());
        $this->assertStringContainsString('inline', $response->headers->get('Content-Disposition'));
        $download = $this->get($url.'?download=1')->assertOk()->assertHeader('Content-Type', 'application/pdf');
        $this->assertStringContainsString('attachment', $download->headers->get('Content-Disposition'));
    }

    public function test_json_queries_and_mutations_preserve_validation_and_scope(): void
    {
        $headers = ['X-Ledger-Branch' => $this->admin->activeBranchOffice->id_hash];
        $this->getJson(route('ledger.index'), $headers)->assertOk()->assertJsonPath('selected', null)->assertJsonPath('statement', null);
        $url = route('ledger.store', $this->account->public_id);
        $this->postJson($url, $this->data(), $headers)->assertCreated()->assertJsonPath('message', 'Movimiento registrado.');
        $entry = LedgerEntry::firstOrFail();
        $this->putJson(route('ledger.update', ['account' => $this->account->public_id, 'entry' => $entry->public_id]),
            $this->data(['amount' => '125', 'version' => 1]), $headers)->assertOk();
        $this->getJson(route('ledger.index', ['account' => $this->account->public_id, 'period' => 'custom', 'from' => '2026-10-01', 'to' => '2026-10-31']), $headers)
            ->assertOk()->assertJsonPath('statement.USD.current', 12500)->assertJsonPath('statement.DOP.current', 0);
        $this->postJson($url, $this->data(['amount' => '-10']), $headers)->assertUnprocessable()->assertJsonValidationErrors('amount');
        $this->postJson($url, $this->data(), ['X-Ledger-Branch' => 'stale-branch'])->assertStatus(409);
        $this->getJson(route('ledger.index'), ['X-Ledger-Branch' => 'stale-branch'])->assertStatus(409);
        $this->assertDatabaseCount('ledger_entries', 1);
        $this->postJson(route('ledger.accounts.store'), ['name' => 'Nueva cuenta'], $headers)->assertOk()->assertJsonStructure(['account', 'message']);
        $this->getJson(route('ledger.index'), $headers)->assertJsonPath('selected', null)->assertJsonCount(2, 'accounts');
        $foreignOffice = Office::create(['name' => 'Otra empresa', 'is_active' => true]);
        $foreign = Account::create(['name' => 'Privado', 'office_id' => $foreignOffice->id]);
        $this->getJson(route('ledger.index', ['account' => $foreign->public_id]), $headers)->assertNotFound();
        $this->admin->roles()->detach();
        $this->getJson(route('ledger.index'), $headers)->assertForbidden();
        $this->postJson($url, $this->data(), $headers)->assertForbidden();
    }

    public function test_purchase_costs_do_not_create_peso_debt_and_are_recalculated(): void
    {
        $data = $this->data(['kind' => 'purchase', 'amount' => null, 'currency' => 'DOP', 'exchange_rate' => '60', 'transport_price' => '25',
            'items' => [['product' => 'Maíz', 'unit' => 'quintal', 'quantity' => '100.5', 'price' => '12.50', 'discount' => '6.25']]]);
        $this->postEntry($data)->assertSessionHasNoErrors();
        $e = LedgerEntry::firstOrFail();
        $this->assertSame('USD', $e->currency);
        $this->assertSame(125000, $e->amount_minor);
        $this->assertSame(7751250, $e->details['cost_minor']);
        $this->assertSame('2512.50', $e->details['transport']);
        $this->assertSame('100.5', $e->details['transport_quantity']);
        $this->assertSame(0, $this->statement()['DOP']['current']);
        $data['transport_price'] = '30';
        $data['version'] = 1;
        $this->updateEntry($e, $data)->assertSessionHasNoErrors();
        $this->assertSame(7801500, $e->fresh()->details['cost_minor']);
        $this->assertDatabaseCount('ledger_audits', 2);
        $this->updateEntry($e, $data)->assertSessionHasErrors('version');
        $data['transport_price'] = null;
        $this->postEntry($data)->assertSessionHasErrors('transport_price');
    }

    public function test_purchase_transport_uses_product_quantity_and_can_be_zero(): void
    {
        $data = $this->data(['kind' => 'purchase', 'amount' => null, 'exchange_rate' => '60', 'transport_price' => '0',
            'items' => [['product' => 'Soya', 'unit' => 'quintal', 'quantity' => '100', 'price' => '12.50', 'discount' => '0']]]);
        $this->postEntry($data)->assertSessionHasNoErrors();
        $e = LedgerEntry::firstOrFail();
        $this->assertSame('0.00', $e->details['transport']);
        $this->assertSame(7500000, $e->details['cost_minor']);
        $data['version'] = 1;
        $data['transport_price'] = '25';
        $data['items'][0]['quantity'] = '200';
        // Forged totals and freight quantities must never override the derived cost.
        $data['transport'] = '1';
        $data['transport_quantity'] = '1';
        $this->updateEntry($e, $data)->assertSessionHasNoErrors();
        $this->assertSame('5000.00', $e->fresh()->details['transport']);
        $this->assertSame('200', $e->fresh()->details['transport_quantity']);
        $this->assertSame(15500000, $e->fresh()->details['cost_minor']);
        $this->assertSame(250000, $e->fresh()->amount_minor);
        $this->assertSame(0, $this->statement()['DOP']['current']);
        $data['items'][] = $data['items'][0];
        $this->postEntry($data)->assertSessionHasErrors('items');
        $data['items'] = [];
        $this->postEntry($data)->assertSessionHasErrors('items');
        $data['items'] = [['product' => 'Soya', 'unit' => 'quintal', 'quantity' => '1.25', 'price' => '12.50', 'discount' => '0']];
        $data['transport_price'] = '-1';
        $this->postEntry($data)->assertSessionHasErrors('transport_price');
        $data['transport_price'] = '0.50';
        $this->postEntry($data)->assertSessionHasNoErrors();
        $this->assertSame('0.63', LedgerEntry::latest('id')->first()->details['transport']);
    }

    public function test_linked_debit_and_credit_edit_together_without_duplicates(): void
    {
        $target = Account::create(['office_id' => $this->account->office_id, 'name' => 'Destino']);
        $data = $this->data(['kind' => 'debit', 'amount' => '150', 'linked' => true, 'linked_account' => $target->public_id, 'linked_mode' => 'full', 'linked_comment' => 'Destino']);
        $this->postEntry($data)->assertSessionHasNoErrors();
        $e = LedgerEntry::where('kind', 'debit')->firstOrFail();
        $this->assertSame(15000, $e->children()->first()->amount_minor);
        $data = array_replace($data, ['version' => 1, 'amount' => '200', 'currency' => 'DOP', 'linked_mode' => 'custom', 'linked_amount' => '75']);
        $this->updateEntry($e, $data)->assertSessionHasNoErrors();
        $this->assertDatabaseCount('ledger_entries', 2);
        $child = $e->children()->first();
        $this->assertSame(7500, $child->amount_minor);
        $this->assertSame('DOP', $child->currency);
        $this->updateEntry($child, $this->data(['version' => $child->version]))->assertSessionHasErrors('version');
        $data['version'] = 2;
        $data['linked_amount'] = '201';
        $this->updateEntry($e, $data)->assertSessionHasErrors('linked_amount');
        $this->assertSame(20000, $e->fresh()->amount_minor);
        $data['linked'] = false;
        $data['linked_amount'] = '75';
        $this->updateEntry($e, $data)->assertSessionHasNoErrors();
        $this->assertSame(0, $child->fresh()->amount_minor);
    }

    public function test_refund_is_explicit_and_editing_does_not_duplicate_it(): void
    {
        $this->postEntry($this->data())->assertSessionHasNoErrors();
        $data = $this->data(['kind' => 'debit', 'amount' => '140', 'excess' => 'refund']);
        $this->postEntry($data)->assertSessionHasNoErrors();
        $e = LedgerEntry::where('kind', 'debit')->firstOrFail();
        $this->assertSame(4000, $e->children()->first()->amount_minor);
        $this->assertSame(0, $this->statement()['USD']['current']);
        $this->updateEntry($e, array_replace($data, ['version' => 1, 'excess' => 'keep']))->assertSessionHasNoErrors();
        $this->assertSame(-4000, $this->statement()['USD']['current']);
        $this->assertDatabaseCount('ledger_entries', 3);
    }

    public function test_cross_company_access_and_linking_are_rejected(): void
    {
        $office = Office::create(['name' => 'B', 'is_active' => true]);
        $foreign = Account::create(['office_id' => $office->id, 'name' => 'Otro']);
        $this->get(route('ledger.index', ['account' => $foreign->public_id]))->assertNotFound();
        $this->get(route('ledger.print', ['account' => $foreign->public_id]))->assertNotFound();
        $this->postEntry($this->data(), $foreign)->assertNotFound();
        $this->postEntry($this->data(['kind' => 'debit', 'linked' => true, 'linked_account' => $foreign->public_id, 'linked_mode' => 'full']))->assertNotFound();
        $this->assertDatabaseCount('ledger_entries', 0);
    }

    public function test_action_permissions_are_enforced_on_server_including_linked_credit(): void
    {
        $role = Role::create(['name' => 'Solo débitos', 'slug' => 'debits', 'office_id' => $this->account->office_id, 'is_active' => true]);
        $role->permissions()->attach(Permission::whereIn('slug', ['ledger.view', 'ledger.debit.create'])->pluck('id'));
        $this->admin->roles()->detach();
        $this->admin->roles()->attach($role, ['office_id' => $this->account->office_id]);
        $this->admin->branchOffices()->attach($this->admin->active_branch_office_id);
        $this->postEntry($this->data())->assertForbidden();
        $target = Account::create(['office_id' => $this->account->office_id, 'name' => 'Destino']);
        $this->postEntry($this->data(['kind' => 'debit', 'linked' => true, 'linked_account' => $target->public_id, 'linked_mode' => 'full']))->assertForbidden();
        $this->assertDatabaseCount('ledger_entries', 0);
        $this->postEntry($this->data(['kind' => 'debit']))->assertSessionHasNoErrors();
        $this->get(route('ledger.print', ['account' => $this->account->public_id]))->assertForbidden();
    }

    public function test_precision_validation_and_date_range(): void
    {
        $this->postEntry($this->data(['amount' => '0.009']))->assertSessionHasErrors('amount');
        $this->postEntry($this->data(['amount' => '-1']))->assertSessionHasErrors('amount');
        $this->postEntry($this->data(['amount' => 10.25]))->assertSessionHasNoErrors();
        $this->assertSame(1025, LedgerEntry::first()->amount_minor);
        $this->get(route('ledger.index', ['period' => 'custom', 'from' => '2026-10-10', 'to' => '2026-10-01']))->assertSessionHasErrors('to');
    }
}
