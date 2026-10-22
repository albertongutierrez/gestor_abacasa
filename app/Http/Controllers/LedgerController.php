<?php

namespace App\Http\Controllers;

use App\Http\Requests\LedgerRequest;
use App\Models\Account;
use App\Models\LedgerEntry;
use App\Services\LedgerService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class LedgerController extends Controller
{
    private function accounts(Request $r)
    {
        $branch = $r->user()->activeBranchOffice;
        abort_unless($branch, 403, 'Selecciona una sucursal antes de abrir los estados de cuenta.');
        if ($r->hasHeader('X-Ledger-Branch')) {
            abort_unless($r->header('X-Ledger-Branch') === $branch->id_hash, 409, 'La sucursal activa cambió. Recarga la página antes de continuar.');
        }

        return Account::where('office_id', $branch->office_id);
    }

    private function period(Request $r): array
    {
        $d = $r->validate(['period' => ['nullable', Rule::in(['month', 'previous', 'quarter', 'custom'])],
            'from' => ['required_if:period,custom', 'nullable', 'date_format:Y-m-d'],
            'to' => ['required_if:period,custom', 'nullable', 'date_format:Y-m-d', 'after_or_equal:from']]);
        $period = $d['period'] ?? 'month';
        [$from, $to] = match ($period) {
            'previous' => [now()->subMonthNoOverflow()->startOfMonth(), now()->subMonthNoOverflow()->endOfMonth()],
            'quarter' => [now()->startOfQuarter(), now()->endOfQuarter()],
            'custom' => [\Carbon\Carbon::parse($d['from']), \Carbon\Carbon::parse($d['to'])],
            default => [now()->startOfMonth(), now()->endOfMonth()],
        };

        return ['period' => $period, 'from' => $from->toDateString(), 'to' => $to->toDateString()];
    }

    public function index(Request $r, LedgerService $service)
    {
        $filters = $this->period($r);
        $accounts = $this->accounts($r)->orderBy('name')->get();
        $totals = LedgerEntry::whereIn('account_id', $accounts->pluck('id'))->selectRaw("account_id, currency, SUM(CASE WHEN kind = 'debit' THEN -amount_minor ELSE amount_minor END) AS balance")->groupBy('account_id', 'currency')->get()->groupBy('account_id');
        $selected = $r->query('account') ? $accounts->firstWhere('public_id', $r->query('account')) : null;
        if ($r->query('account')) {
            abort_unless($selected, 404);
        }

        $payload = ['accounts' => $accounts->map(fn ($a) => [
            'id' => $a->public_id, 'name' => $a->name, 'document' => $a->document, 'phone' => $a->phone, 'notes' => $a->notes,
            'balances' => ($totals[$a->id] ?? collect())->pluck('balance', 'currency')]),
            'selected' => $selected?->public_id, 'filters' => $filters,
            'statement' => $selected ? $service->statement($selected, $filters['from'], $filters['to']) : null];

        return $r->expectsJson()
            ? response()->json($payload)->header('Cache-Control', 'private, no-store')
            : Inertia::render('Ledger/Index', $payload);
    }

    public function purchases(Request $r)
    {
        $filters = $this->period($r);
        $r->validate(['account' => ['nullable', 'string'], 'page' => ['nullable', 'integer', 'min:1']]);
        $accounts = $this->accounts($r)->orderBy('name')->get();
        $selected = $r->query('account') ? $accounts->firstWhere('public_id', $r->query('account')) : null;
        abort_if($r->query('account') && !$selected, 404);
        $query = LedgerEntry::with('account')->whereIn('account_id', $accounts->pluck('id'))
            ->where('kind', 'purchase')->whereBetween('date', [$filters['from'], $filters['to']]);
        if ($selected) $query->where('account_id', $selected->id);
        $total = (clone $query)->sum('amount_minor');
        $purchases = $query->orderByDesc('date')->orderByDesc('id')->paginate(20)->through(fn ($e) => [
            'id' => $e->public_id, 'account_id' => $e->account->public_id, 'account_name' => $e->account->name,
            'kind' => 'purchase', 'date' => $e->date, 'currency' => 'USD', 'amount_minor' => $e->amount_minor,
            'reference' => $e->reference, 'comment' => $e->comment, 'details' => $e->details, 'version' => $e->version,
            'balance' => 0, 'source_id' => null, 'source_account' => null, 'source_date' => null,
        ]);
        $payload = ['accounts' => $accounts->map(fn ($a) => ['id' => $a->public_id, 'name' => $a->name,
            'document' => $a->document, 'phone' => $a->phone, 'notes' => $a->notes, 'balances' => []]),
            'filters' => [...$filters, 'account' => $selected?->public_id ?? ''], 'purchases' => $purchases, 'total' => (int) $total];
        return $r->expectsJson() ? response()->json($payload)->header('Cache-Control', 'private, no-store') : Inertia::render('Ledger/Purchases', $payload);
    }

    public function purchaseShow(Request $r, string $entry)
    {
        $e = LedgerEntry::with('account')->whereIn('account_id', $this->accounts($r)->select('id'))
            ->where('kind', 'purchase')->where('public_id', $entry)->firstOrFail();
        $a = $e->account;
        $payload = ['account' => ['id' => $a->public_id, 'name' => $a->name, 'document' => $a->document,
            'phone' => $a->phone, 'notes' => $a->notes, 'balances' => []],
            'purchase' => ['id' => $e->public_id, 'kind' => 'purchase', 'date' => $e->date,
                'currency' => 'USD', 'amount_minor' => $e->amount_minor, 'reference' => $e->reference,
                'comment' => $e->comment, 'details' => $e->details, 'version' => $e->version,
                'balance' => 0, 'source_id' => null, 'source_account' => null, 'source_date' => null]];
        $payload['issuer'] = $this->purchaseIssuer($r);
        return $r->expectsJson() ? response()->json($payload)->header('Cache-Control', 'private, no-store')
            : Inertia::render('Ledger/PurchaseShow', $payload);
    }

    public function purchaseCancel(Request $r, string $entry, LedgerService $service)
    {
        $data = $r->validate(['version' => ['required', 'integer', 'min:1']]);
        $purchase = LedgerEntry::with('account')->whereIn('account_id', $this->accounts($r)->select('id'))
            ->where('kind', 'purchase')->where('public_id', $entry)->firstOrFail();
        $service->cancelPurchase($purchase->account, $purchase, $data['version'], $r->user());
        return response()->json(['message' => 'Compra cancelada y balance actualizado.']);
    }

    public function purchasePrint(Request $r, string $entry)
    {
        $purchase = LedgerEntry::with('account')->whereIn('account_id', $this->accounts($r)->select('id'))
            ->where('kind', 'purchase')->where('public_id', $entry)->firstOrFail();
        $issuer = $this->purchaseIssuer($r);
        $office = $r->user()->activeBranchOffice->office;
        $logoPath = $office->compact_logo_path ?: $office->logo_path;
        $logo = $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->path($logoPath) : public_path('brand/abacasa-transparent.png');
        if (!is_file($logo)) $logo = public_path('brand/abacasa-transparent.png');
        $logoData = 'data:'.mime_content_type($logo).';base64,'.base64_encode(file_get_contents($logo));
        foreach ([10, 9, 8, 7, 6, 5] as $fontSize) {
            $pdf = app('dompdf.wrapper')->loadView('ledger.purchase', compact('purchase', 'issuer', 'logoData', 'fontSize'))->setPaper('a4');
            $pdf->render();
            if ($pdf->getDomPDF()->getCanvas()->get_page_count() === 1) break;
        }
        abort_if($pdf->getDomPDF()->getCanvas()->get_page_count() !== 1, 422, 'El contenido es demasiado extenso para una página. Reduce las observaciones.');
        $filename = 'compra-v2-'.$purchase->public_id.'.pdf';
        $response = $r->boolean('download') ? $pdf->download($filename) : $pdf->stream($filename);
        return $response->header('Cache-Control', 'private, no-store');
    }

    public function creditCancel(Request $r, string $entry, LedgerService $service)
    {
        $data = $r->validate(['version' => ['required', 'integer', 'min:1']]);
        $credit = LedgerEntry::with('account')->whereIn('account_id', $this->accounts($r)->select('id'))
            ->where('kind', 'credit')->whereNull('source_id')->where('public_id', $entry)->firstOrFail();
        $service->cancelCredit($credit->account, $credit, $data['version'], $r->user());
        return response()->json(['message' => 'Crédito cancelado y balance actualizado.']);
    }

    public function debitCancel(Request $r, string $entry, LedgerService $service)
    {
        $data = $r->validate(['version' => ['required', 'integer', 'min:1']]);
        $debit = LedgerEntry::with('account')->whereIn('account_id', $this->accounts($r)->select('id'))
            ->where('kind', 'debit')->where('public_id', $entry)->firstOrFail();
        $service->cancelDebit($debit->account, $debit, $data['version'], $r->user());
        return response()->json(['message' => 'Débito cancelado y balances actualizados.']);
    }

    private function purchaseIssuer(Request $r): array
    {
        $branch = $r->user()->activeBranchOffice;
        $office = $branch->office;
        $logoPath = $office->compact_logo_path ?: $office->logo_path;
        return ['name' => $office->name,
            'logo' => $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->url($logoPath) : asset('brand/abacasa-transparent.png'),
            'lines' => array_values(array_filter([
                $office->legal_name && $office->legal_name !== $office->name ? $office->legal_name : null,
                $office->slogan,
                $office->tax_id ? 'RNC: '.$office->tax_id : null,
                $office->address,
                $office->phone ? 'Tel.: '.$office->phone : null,
                $office->email,
                $office->branchOffices()->count() > 1 ? 'Sucursal: '.$branch->name.($branch->code ? ' · '.$branch->code : '') : null,
                $branch->address && $branch->address !== $office->address ? $branch->address : null,
                $branch->phone && $branch->phone !== $office->phone ? 'Tel. sucursal: '.$branch->phone : null,
                $branch->mobile_phone ? 'Cel.: '.$branch->mobile_phone : null,
                $branch->email && $branch->email !== $office->email ? $branch->email : null,
            ]))];
    }

    public function account(Request $r, ?string $account = null)
    {
        $data = $r->validate(['name' => ['required', 'string', 'max:255'], 'document' => ['nullable', 'string', 'max:50'],
            'phone' => ['nullable', 'string', 'max:50'], 'notes' => ['nullable', 'string', 'max:4000']]);
        $a = $account ? $this->accounts($r)->where('public_id', $account)->firstOrFail() : new Account(['office_id' => $r->user()->activeBranchOffice?->office_id]);
        $this->accounts($r);
        $a->fill($data)->save();

        if ($r->expectsJson()) {
            return response()->json(['message' => 'Cuenta guardada.', 'account' => $a->public_id]);
        }

        return to_route('ledger.index', ['account' => $a->public_id])->with('success', 'Cuenta guardada.');
    }

    public function store(LedgerRequest $r, string $account, LedgerService $service)
    {
        $a = $this->accounts($r)->where('public_id', $account)->firstOrFail();
        $service->save($a, $r->validated(), $r->user());

        if ($r->expectsJson()) {
            return response()->json(['message' => 'Movimiento registrado.'], 201);
        }

        return back()->with('success', 'Movimiento registrado.');
    }

    public function update(LedgerRequest $r, string $account, string $entry, LedgerService $service)
    {
        $a = $this->accounts($r)->where('public_id', $account)->firstOrFail();
        $e = $a->entries()->where('public_id', $entry)->firstOrFail();
        $service->save($a, $r->validated(), $r->user(), $e);

        if ($r->expectsJson()) {
            return response()->json(['message' => 'Movimiento corregido y balances actualizados.']);
        }

        return back()->with('success', 'Movimiento corregido y balances actualizados.');
    }

    public function print(Request $r, string $account, LedgerService $service)
    {
        $a = $this->accounts($r)->where('public_id', $account)->firstOrFail();
        $filters = $this->period($r);

        $office = $r->user()->activeBranchOffice->office;
        $logoPath = $office->compact_logo_path ?: $office->logo_path;
        $logo = $logoPath ? \Illuminate\Support\Facades\Storage::disk('public')->path($logoPath) : public_path('brand/abacasa-transparent.png');
        if (!is_file($logo)) $logo = public_path('brand/abacasa-transparent.png');
        $pdf = app('dompdf.wrapper')->loadView('ledger.statement', ['account' => $a, 'filters' => $filters,
            'issuer' => $this->purchaseIssuer($r),
            'logoData' => 'data:'.mime_content_type($logo).';base64,'.base64_encode(file_get_contents($logo)),
            'statement' => $service->statement($a, $filters['from'], $filters['to'])])->setPaper('a4', 'portrait');
        $pdf->render();
        $pdf->getDomPDF()->getCanvas()->page_script(function ($pageNumber, $pageCount, $canvas, $fontMetrics) {
            $font = $fontMetrics->getFont('DejaVu Sans', 'normal');
            $text = "Página {$pageNumber} de {$pageCount}";
            $width = $fontMetrics->getTextWidth($text, $font, 8);
            $canvas->text(($canvas->get_width() - $width) / 2, $canvas->get_height() - 30, $text, $font, 8, [0.32, 0.4, 0.38]);
        });
        $filename = 'estado-cuenta-'.$a->public_id.'-'.$filters['from'].'-'.$filters['to'].'.pdf';
        $response = $r->boolean('download') ? $pdf->download($filename) : $pdf->stream($filename);
        return $response->header('Cache-Control', 'private, no-store');
    }
}
