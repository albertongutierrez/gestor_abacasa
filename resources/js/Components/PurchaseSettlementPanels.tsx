import { useState } from 'react';
import { CalendarDays, Package, Wallet } from 'lucide-react';
import PurchaseActions from '@/Components/PurchaseActions';
import { monthLabel, usd, SettlementSummary } from '@/lib/purchaseSettlements';
import type { Row } from '@/Pages/Ledger/Index';

export default function PurchaseSettlementPanels({ summary, accountId, can, onEdit }: {
    summary: SettlementSummary; accountId: string; can: (p: string) => boolean | undefined; onEdit: (row: Row) => void;
}) {
    const [product, setProduct] = useState('Maíz');
    const [month, setMonth] = useState(summary.groups[0]?.month ?? new Date().toISOString().slice(0, 7));
    const months = [...new Set([month, ...summary.groups.map(g => g.month)])].sort().reverse();
    const group = summary.groups.find(g => g.month === month && g.product === product);
    const card = 'min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
    return <section aria-label="Balances por mes y producto" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2"><div className={card}><p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><Package size={16} />Compras pendientes · todos los meses</p><strong className="mt-2 block text-2xl tabular-nums">{usd(summary.pending_minor)}</strong></div>
            <div className={card + ' border-emerald-300 dark:border-emerald-800'}><p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Wallet size={16} />Saldo a favor disponible</p><strong className="mt-2 block text-2xl tabular-nums text-emerald-700 dark:text-emerald-300">{usd(summary.available_minor)}</strong><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sin aplicar. Selecciona mes y producto al registrar el pago.</p></div></div>
        {summary.general_pending_minor > 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Otros créditos pendientes fuera de compras V2: {usd(summary.general_pending_minor)}.</p>}
        <div className={card}>
            <div className="flex flex-wrap items-end justify-between gap-4"><div role="tablist" aria-label="Producto" className="flex gap-2">{['Maíz', 'Soya'].map(p => <button key={p} type="button" role="tab" aria-selected={p === product} onClick={() => setProduct(p)} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-semibold ${p === product ? 'bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}><Package size={16} />{p}</button>)}</div>
                <label className="block w-full text-sm font-medium sm:w-auto"><span className="flex items-center gap-2"><CalendarDays size={15} />Mes del producto</span><select className="mt-1 min-h-11 w-full rounded-lg border-slate-300 bg-white text-base dark:border-slate-600 dark:bg-slate-950 sm:text-sm" value={month} onChange={e => setMonth(e.target.value)}>{months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}</select></label></div>
            <div className="my-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">{[['Compras', group?.purchases_minor], ['Pagos aplicados', group?.applied_minor], ['Pendiente', group?.pending_minor]].map(([label, value]) => <div key={label} className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{label}</p><strong className="mt-1 block break-words text-sm tabular-nums sm:text-lg">{usd(Number(value ?? 0))}</strong></div>)}</div>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{product} · {monthLabel(month)}. La fecha del movimiento puede pertenecer a otro mes.</p>
            {group?.rows.length ? <div className="divide-y divide-slate-200 dark:divide-slate-700">{group.rows.map(row => <article key={row.id} className="flex items-start gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-xs text-slate-500 dark:text-slate-400">{row.date.split('-').reverse().join('/')}</p><p className="mt-1 break-words text-sm font-semibold">{row.kind === 'purchase' ? 'Compra V2' : row.details.applied_minor ? 'Pago aplicado' : 'Abono sin aplicar'}{row.reference ? ` · ${row.reference}` : ''}</p>{row.kind === 'debit' && <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Dinero nuevo: {usd(row.amount_minor)} · Saldo utilizado: {usd(row.details.credit_used_minor ?? 0)}</p>}{row.comment && <p className="mt-1 break-words text-xs text-slate-500 dark:text-slate-400">{row.comment}</p>}</div><div className="max-w-[42%] text-right"><strong className="block break-words text-sm tabular-nums">{usd(row.kind === 'purchase' ? row.amount_minor : row.details.applied_minor ?? 0)}</strong><span className="mt-1 block break-words text-xs text-slate-500 dark:text-slate-400">Pendiente: {usd(row.balance)}</span></div><PurchaseActions row={row} accountId={accountId} canEdit={!!can('ledger.' + row.kind + '.update')} showView={row.kind === 'purchase'} showAccountLink={false} onEdit={() => onEdit(row)} /></article>)}</div> : <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Sin compras ni pagos asignados a este mes y producto.</p>}
        </div>
    </section>;
}
