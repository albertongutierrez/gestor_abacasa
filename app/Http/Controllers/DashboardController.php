<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\LedgerEntry;
use Illuminate\Http\Request;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $branch = $request->user()->activeBranchOffice;
        if (!$branch || !$request->user()->canDo('ledger.view')) {
            return Inertia::render('Dashboard', ['summary' => null]);
        }
        $today = now()->toDateString();
        $from = now()->startOfMonth()->toDateString();
        $accounts = Account::where('office_id', $branch->office_id);
        $entries = LedgerEntry::whereIn('account_id', (clone $accounts)->select('id'))->where('date', '<=', $today);
        $balances = (clone $entries)->selectRaw("account_id, currency, SUM(CASE WHEN kind = 'debit' THEN -amount_minor ELSE amount_minor END) AS balance")
            ->groupBy('account_id', 'currency')->get();
        $month = (clone $entries)->where('date', '>=', $from)->where('amount_minor', '>', 0);
        $activity = (clone $month)->selectRaw('currency, kind, SUM(amount_minor) AS total, COUNT(*) AS movements')->groupBy('currency', 'kind')->get();
        $chartStart = now()->startOfMonth()->subMonths(11);
        $monthly = (clone $entries)->where('date', '>=', $chartStart->toDateString())->where('amount_minor', '>', 0)
            ->selectRaw('SUBSTR(date, 1, 7) AS month, currency, kind, SUM(amount_minor) AS total')
            ->groupByRaw('SUBSTR(date, 1, 7), currency, kind')->get();
        $history = [];
        for ($i = 0; $i < 12; $i++) {
            $key = $chartStart->copy()->addMonths($i)->format('Y-m');
            $point = ['month' => $key];
            foreach (['USD', 'DOP'] as $currency) {
                $group = $monthly->where('month', $key)->where('currency', $currency);
                $point[$currency] = [
                    'credits' => (int) $group->whereIn('kind', ['credit', 'purchase'])->sum('total'),
                    'debits' => (int) $group->where('kind', 'debit')->sum('total'),
                    'purchases' => (int) $group->where('kind', 'purchase')->sum('total'),
                ];
            }
            $history[] = $point;
        }
        $currencies = [];
        foreach (['USD', 'DOP'] as $currency) {
            $rows = $balances->where('currency', $currency);
            $current = $activity->where('currency', $currency);
            $currencies[$currency] = [
                'pending' => (int) $rows->where('balance', '>', 0)->sum('balance'),
                'favor' => (int) abs($rows->where('balance', '<', 0)->sum('balance')),
                'pending_accounts' => $rows->where('balance', '>', 0)->count(),
                'favor_accounts' => $rows->where('balance', '<', 0)->count(),
                'debits' => (int) $current->where('kind', 'debit')->sum('total'),
                'credits' => (int) $current->whereIn('kind', ['credit', 'purchase'])->sum('total'),
                'refunds' => (int) $current->where('kind', 'refund')->sum('total'),
            ];
        }
        $names = (clone $accounts)->get()->keyBy('id');
        $top = [];
        foreach (['USD', 'DOP'] as $currency) {
            $top[$currency] = $balances->where('currency', $currency)->where('balance', '>', 0)
                ->sortByDesc('balance')->take(5)->map(fn ($row) => [
                    'id' => $names[$row->account_id]->public_id, 'name' => $names[$row->account_id]->name,
                    'balance' => (int) $row->balance,
                ])->values();
        }
        return Inertia::render('Dashboard', ['summary' => [
            'from' => $from, 'to' => $today, 'accounts' => $names->count(), 'currencies' => $currencies, 'top' => $top, 'history' => $history,
            'purchases' => (int) $activity->where('kind', 'purchase')->sum('movements'),
            'purchase_total' => (int) $activity->where('kind', 'purchase')->sum('total'),
            'recent' => (clone $entries)->where('amount_minor', '>', 0)->with('account')->orderByDesc('date')->orderByDesc('id')->limit(8)->get()->map(fn ($row) => [
                'id' => $row->public_id, 'account' => $row->account->public_id, 'name' => $row->account->name,
                'date' => $row->date, 'kind' => $row->kind, 'currency' => $row->currency, 'amount' => $row->amount_minor,
            ]),
        ]]);
    }
}
