import PurchaseSettlementPanels from '@/Components/PurchaseSettlementPanels';
import { SettlementSummary, monthLabel, settlementLabel } from '@/lib/purchaseSettlements';
import MoneyInput from '@/Components/MoneyInput';
import PurchaseActions from '@/Components/PurchaseActions';
import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import axios from 'axios';
import { useQuery } from '@tanstack/react-query';
import { ledgerHeaders, ledgerError, useLedgerForm } from '@/lib/ledgerQuery';
import { ArrowDownLeft, ArrowUpRight, Download, FileText, Pencil, Plus, Truck, Wallet, X } from 'lucide-react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AccountCombobox from '@/Components/AccountCombobox';
import { PageProps } from '@/types';

type Currency = 'USD' | 'DOP';
type Kind = 'credit' | 'debit' | 'purchase';
type Item = { product: string; unit: string; quantity: string; price: string; discount: string };
type Form = { kind: Kind; currency: Currency; date: string; amount: string; reference: string; comment: string; version: number;
    excess: string; linked: boolean; linked_account: string; linked_mode: string; linked_amount: string; linked_comment: string;
    items: Item[]; exchange_rate: string; transport_price: string; settlement_month: string; product: string; credit_used: string };
export type Row = { id: string; kind: Kind | 'refund'; date: string; currency: Currency; amount_minor: number; balance: number; comment: string; reference: string; version: number; details: Partial<Form> & { cost_minor?: number; transport?: string; cancelled_at?: string; original_amount_minor?: number; credit_used_minor?: number; applied_minor?: number }; source_id: string | null; source_account: string | null; source_date: string | null };
type Statement = { opening: number; closing: number; current: number; debit: number; credit: number; rows: Row[] };
export type Account = { id: string; name: string; document: string; phone: string; notes: string; balances: Partial<Record<Currency, number>>; uses_purchases?: boolean };
type Props = PageProps<{ accounts: Account[]; selected: string | null; filters: { period: string; from: string; to: string }; statement: Record<Currency, Statement> | null; settlement: SettlementSummary | null }>;
const money = (v: number, c: string) => {
    const amount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v) / 100);
    return `${c === 'USD' ? 'USD$' : 'RD$'} ${v < 0 ? `(${amount})` : amount}`;
};
const labels = { purchase: 'Compra V2', credit: 'Crédito', debit: 'Débito', refund: 'Devolución' };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const line = (): Item => ({ product: 'Maíz', unit: 'quintal', quantity: '', price: '', discount: '0' });
const initial = (kind: Kind): Form => ({ kind, currency: 'USD', date: today(), amount: '', reference: '', comment: '', version: 1, excess: 'keep', linked: false, linked_account: '', linked_mode: 'full', linked_amount: '', linked_comment: '', items: kind === 'purchase' ? [line()] : [], exchange_rate: '', transport_price: '0', settlement_month: today().slice(0, 7), product: '', credit_used: '0' });
const input = 'mt-1 min-w-0 max-w-full w-full rounded-lg border-slate-300 bg-white text-base sm:text-sm dark:border-slate-700 dark:bg-slate-950';
const secondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 min-h-[44px] px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 disabled:opacity-40';
const primary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 min-h-[44px] px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-40';
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block min-w-0 text-sm font-medium">{label}{children}</label>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        ref.current?.showModal();
        return () => { document.body.style.overflow = previousOverflow; };
    }, []);
    return <dialog ref={ref} onCancel={e => { e.preventDefault(); close(); }} className="ledger-modal bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:bg-slate-900 dark:text-slate-100" aria-label={title}>
        <div className="ledger-modal-shell"><div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 sm:p-5"><h2 className="min-w-0 break-words text-base font-semibold leading-6 sm:text-xl">{title}</h2><button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" onClick={close} aria-label="Cerrar"><X /></button></div><div className="ledger-modal-body">{children}</div></div></dialog>;
}
type LedgerData = Pick<Props, 'accounts' | 'selected' | 'filters' | 'statement' | 'settlement'>;
export default function Index(props: Props) {
    return <LedgerPage key={JSON.stringify([props.auth.user.id, props.auth.activeBranchOffice?.id_hash, props.selected, props.filters])} {...props} />;
}
function LedgerPage(props: Props) {
    const { auth } = props;
    const branch = auth.activeBranchOffice?.id_hash ?? '';
    const [criteria, setCriteria] = useState({ account: props.selected ?? '', ...props.filters });
    const isInitial = JSON.stringify(criteria) === JSON.stringify({ account: props.selected ?? '', ...props.filters });
    const query = useQuery<LedgerData>({
        queryKey: ['ledger', auth.user.id, branch, criteria],
        queryFn: async ({ signal }) => {
            const response = await axios.get<LedgerData>(route('ledger.index'), { params: criteria, signal, headers: ledgerHeaders(branch) });
            if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('Respuesta de sesión inválida');
            return response.data;
        },
        initialData: isInitial ? { accounts: props.accounts, selected: props.selected, filters: props.filters, statement: props.statement, settlement: props.settlement } : undefined,
        staleTime: 0,
    });
    const accounts = query.isError ? [] : (query.data?.accounts ?? props.accounts);
    const selected = criteria.account || null;
    const filters = query.data?.filters ?? criteria;
    const statement = query.isError ? null : query.data?.statement ?? null;
    const settlement = query.data?.settlement;
    const [movementView, setMovementView] = useState<'general' | 'products'>('general');
    const [currency, setCurrency] = useState<Currency>('USD');
    const [period, setPeriod] = useState(filters.period); const [from, setFrom] = useState(filters.from); const [to, setTo] = useState(filters.to);
    const [editor, setEditor] = useState<{ kind: Kind; row?: Row } | null>(null);
    const [accountEditor, setAccountEditor] = useState<Account | 'new' | null>(null);
    const account = accounts.find(a => a.id === selected); const s = statement?.[currency];
    const can = (p: string) => auth.user.is_super_admin || auth.user.permissions?.includes(p);
    useEffect(() => { setPeriod(filters.period); setFrom(filters.from); setTo(filters.to); }, [filters]);
    const visit = (id: string, custom?: Record<string, string>) => {
        setEditor(null); setAccountEditor(null); setMovementView('general');
        const next = { ...filters, ...custom, account: id };
        setCriteria(next);
        // Keep this page reloadable; entering the module's plain URL starts empty.
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries(next)) {
            if (value) url.searchParams.set(key, value);
            else url.searchParams.delete(key);
        }
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    };
    return <AuthenticatedLayout user={auth.user} header="Cuentas · Créditos y débitos"><Head title="Estados de cuenta" />
        <div className="mx-auto max-w-[1440px] space-y-5">
        {query.isFetching && <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Actualizando cuentas y balances…</p>}
        {query.isError && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">{ledgerError(query.error)} <button className="ml-3 underline" onClick={() => query.refetch()}>Reintentar</button></div>}
        <div className="flex flex-wrap items-center justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">Estados de cuenta</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Consulta balances y registra movimientos.</p></div>
            {can('ledger.accounts.create') && <button className={secondary} onClick={() => setAccountEditor('new')}><Plus size={16} />Nueva cuenta</button>}</div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <AccountCombobox accounts={accounts} value={selected} onChange={id => visit(id)} />
        </div>
        <section className="min-w-0 space-y-5">{account && statement ? <>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">{account.name.slice(0, 1).toUpperCase()}</div><div><h2 className="text-lg font-semibold">{account.name}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{[account.document, account.phone].filter(Boolean).join(' · ') || 'Cliente / proveedor'}</p></div></div><div className="flex items-center gap-2">{can('ledger.accounts.update') && <button className={secondary} onClick={() => setAccountEditor(account)}><Pencil size={14} />Editar datos</button>}</div></div>
                <div className="grid grid-cols-2 divide-x divide-slate-100 dark:divide-slate-800">{(['USD', 'DOP'] as Currency[]).map(c => <div key={c} className="min-w-0 px-3 py-4 sm:px-5"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs font-medium sm:text-sm text-slate-600 dark:text-slate-300">{c === 'USD' ? 'Dólares estadounidenses' : 'Pesos dominicanos'}</span><span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statement[c].current < 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : statement[c].current > 0 ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{statement[c].current < 0 ? 'A favor' : statement[c].current > 0 ? 'Pendiente' : 'Saldada'}</span></div><div className="mt-2 break-words text-lg font-semibold tabular-nums tracking-tight sm:text-3xl">{money(statement[c].current, c)}</div><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{settlement && c === 'USD' ? 'Balance neto de la cuenta' : 'Balance actual'}</p></div>)}</div>
                {account.notes && <p className="border-t border-slate-100 px-5 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">{account.notes}</p>}
            </div>
            <div className="space-y-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
                <h3 className="font-semibold">Movimientos</h3>
                <div role="group" aria-label="Registrar movimiento" className="grid w-full auto-cols-fr grid-flow-col gap-2 sm:w-auto sm:min-w-[330px]">
                    {can('ledger.purchase.create') && <button type="button" className="flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-2 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 sm:min-h-[44px] sm:flex-row sm:gap-2 sm:px-4 sm:text-sm" onClick={() => setEditor({ kind: 'purchase' })}><Truck size={18} className="shrink-0" /><span className="whitespace-nowrap">Compra V2</span></button>}
                    {can('ledger.credit.create') && <button type="button" className="flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs font-semibold transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 sm:min-h-[44px] sm:flex-row sm:gap-2 sm:px-4 sm:text-sm" onClick={() => setEditor({ kind: 'credit' })}><ArrowUpRight size={18} className="shrink-0" /><span>Crédito</span></button>}
                    {can('ledger.debit.create') && <button type="button" aria-label="Débito / abono" className="flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-xs font-semibold transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800 sm:min-h-[44px] sm:flex-row sm:gap-2 sm:px-4 sm:text-sm" onClick={() => setEditor({ kind: 'debit' })}><ArrowDownLeft size={18} className="shrink-0" /><span className="sm:hidden">Débito</span><span className="hidden whitespace-nowrap sm:inline">Débito / abono</span></button>}
                </div>
            </div>
            {settlement && <div className="flex flex-wrap items-center justify-between gap-3"><div role="group" aria-label="Vista de movimientos" className="flex gap-2">{(['general', 'products'] as const).map(view => <button key={view} type="button" aria-pressed={movementView === view} className={secondary + (movementView === view ? ' bg-emerald-700 text-white hover:bg-emerald-800' : '')} onClick={() => setMovementView(view)}>{view === 'general' ? 'Estado general' : 'Maíz y soya'}</button>)}</div><span className="text-sm text-emerald-700 dark:text-emerald-300">Disponible sin aplicar: <strong>{money(settlement.available_minor, 'USD')}</strong></span></div>}
            {movementView === 'products' && settlement ? <PurchaseSettlementPanels key={account.id} summary={settlement} accountId={account.id} can={can} onEdit={row => setEditor({ kind: row.kind as Kind, row })} /> : <>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-6 border-b border-slate-200 px-5 dark:border-slate-700" role="tablist" aria-label="Moneda del estado de cuenta">{(['USD', 'DOP'] as Currency[]).map(c => <button key={c} type="button" role="tab" aria-selected={currency === c} onClick={() => setCurrency(c)} className={`border-b-2 py-3.5 text-sm font-semibold transition-colors ${currency === c ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300' : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}>{c === 'USD' ? 'Dólares · USD' : 'Pesos · RD$'} <span className="ml-1 text-xs opacity-70">({statement[c].rows.length})</span></button>)}</div><form onSubmit={e => { e.preventDefault(); visit(account.id, { period, ...(period === 'custom' ? { from, to } : {}) }); }} className="flex flex-wrap items-end gap-3 border-b border-slate-200 p-4 dark:border-slate-800"><Field label="Período"><select className={input} value={period} onChange={e => setPeriod(e.target.value)}><option value="month">Este mes</option><option value="previous">Mes anterior</option><option value="quarter">Este trimestre</option><option value="custom">Personalizado</option></select></Field>{period === 'custom' && <><Field label="Desde"><input type="date" required className={input} value={from} onChange={e => setFrom(e.target.value)} /></Field><Field label="Hasta"><input type="date" min={from} required className={input} value={to} onChange={e => setTo(e.target.value)} /></Field></>}<button className={secondary}>Aplicar</button>{can('ledger.export') && <><a className={`${secondary} sm:ml-auto`} href={route('ledger.print', { account: account.id, ...filters })} target="_blank" rel="noreferrer"><FileText size={16} />Ver PDF</a><a className={secondary} href={route('ledger.print', { account: account.id, ...filters, download: 1 })}><Download size={16} />Descargar PDF</a></>}</form>
                    <div className="flex flex-wrap justify-between gap-2 px-4 py-3 text-xs text-slate-500"><span>{currency} · {filters.from} — {filters.to}</span><span>Balance = anterior + créditos − débitos</span></div>
                    <div className="md:hidden"><div className="flex justify-between gap-2 border-y border-slate-200 p-4 text-sm dark:border-slate-700"><span>Balance anterior</span><strong>{money(s?.opening ?? 0, currency)}</strong></div>
{s?.rows.map(row => <article key={row.id} className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-700"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-xs text-slate-500 dark:text-slate-400">{row.date}</p><h4 className="mt-1 break-words font-semibold">{labels[row.kind]} {row.reference}</h4></div>{(row.kind === 'purchase' || row.kind === 'debit' || (row.kind === 'credit' && !row.source_id && !!can('ledger.credit.update'))) ? <PurchaseActions row={row} accountId={account.id} canEdit={!!can('ledger.' + row.kind + '.update')} showAccountLink={false} showView={row.kind === 'purchase'} onEdit={() => setEditor({kind:row.kind as Kind,row})} /> : (!row.source_id && !row.details.cancelled_at && row.kind !== 'refund' && can('ledger.' + row.kind + '.update') && <button className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 dark:border-slate-600" aria-label="Editar movimiento" onClick={() => setEditor({kind:row.kind as Kind,row})}><Pencil size={16} className="mx-auto" /></button>)}</div>{settlement && row.kind === 'debit' && row.currency === 'USD' && !row.details.settlement_month && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sin asignar a mes y producto</p>}{settlementLabel(row) && <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{settlementLabel(row)}</p>}{row.kind === 'debit' && row.details.applied_minor !== undefined && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aplicado: {money(row.details.applied_minor, 'USD')} · Saldo utilizado: {money(row.details.credit_used_minor ?? 0, 'USD')}</p>}{row.comment && <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">{row.comment}</p>}<div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><div><p className="text-xs text-slate-500 dark:text-slate-400">{row.kind === 'debit' ? 'Débito' : 'Crédito'}</p><p className="mt-1 break-words font-medium tabular-nums">{money(row.amount_minor,currency)}</p></div><div className="text-right"><p className="text-xs text-slate-500 dark:text-slate-400">Balance</p><p className="mt-1 break-words font-semibold tabular-nums">{money(row.balance,currency)}</p></div></div>{row.kind === 'purchase' && <p className="text-xs text-slate-500 dark:text-slate-400">Costo camión: {money(row.details.cost_minor ?? 0,'DOP')}</p>}{row.source_id && <Link className="inline-block py-2 text-sm text-emerald-600 dark:text-emerald-300" href={route('ledger.index',{account:row.source_account,period:'custom',from:row.source_date,to:row.source_date})}>Ver débito de origen</Link>}</article>)}
{!s?.rows.length && <div className="p-8 text-center"><FileText className="mx-auto mb-3 text-slate-400" /><p className="text-sm font-medium">Sin movimientos en este período</p></div>}
<div className="space-y-2 bg-slate-50 p-4 text-sm dark:bg-slate-800"><div className="flex justify-between gap-2"><span>Total débitos</span><span>{money(s?.debit ?? 0,currency)}</span></div><div className="flex justify-between gap-2"><span>Total créditos</span><span>{money(s?.credit ?? 0,currency)}</span></div><div className="flex justify-between gap-2 border-t border-slate-300 pt-2 font-semibold dark:border-slate-600"><span>Cierre</span><span>{money(s?.closing ?? 0,currency)}</span></div></div></div><div className="hidden overflow-x-auto md:block"><table className="w-full text-sm tabular-nums"><thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800"><tr>{['Fecha / concepto', 'Débito', 'Crédito', 'Balance', ''].map((h, i) => <th key={i} className={`px-4 py-3 ${i === 0 ? 'text-left' : 'text-right'}`}>{h}</th>)}</tr></thead><tbody>
                        <tr className="border-b dark:border-slate-800"><td className="px-4 py-3 text-slate-500" colSpan={3}>Balance anterior</td><td className="whitespace-nowrap px-4 py-3 text-right font-medium">{money(s?.opening ?? 0, currency)}</td><td /></tr>
                        {s?.rows.map(row => <tr key={row.id} className="border-b border-slate-100 align-top dark:border-slate-800"><td className="min-w-[220px] px-4 py-4"><div className="text-xs text-slate-500">{row.date}</div><div className="mt-1 font-medium">{labels[row.kind]}{row.reference ? ` · ${row.reference}` : ''}</div>{settlement && row.kind === 'debit' && row.currency === 'USD' && !row.details.settlement_month && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">Sin asignar a mes y producto</p>}{settlementLabel(row) && <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">{settlementLabel(row)}</p>}{row.kind === 'debit' && row.details.applied_minor !== undefined && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Aplicado: {money(row.details.applied_minor, 'USD')} · Saldo utilizado: {money(row.details.credit_used_minor ?? 0, 'USD')}</p>}{row.comment && <p className="mt-1 max-w-sm whitespace-pre-wrap break-words text-xs text-slate-500">{row.comment}</p>}{row.kind === 'purchase' && <p className="mt-1 text-xs text-slate-500">Costo camión: {money(row.details.cost_minor ?? 0, 'DOP')} (informativo)</p>}{row.source_id && <Link className="mt-1 block text-xs text-emerald-700 underline dark:text-emerald-400" href={route('ledger.index', { account: row.source_account, period: 'custom', from: row.source_date, to: row.source_date })}>Ver débito de origen para corregir</Link>}</td>
                            <td className="whitespace-nowrap px-4 py-4 text-right">{row.kind === 'debit' ? money(row.amount_minor, currency) : '—'}</td><td className="whitespace-nowrap px-4 py-4 text-right">{row.kind !== 'debit' ? money(row.amount_minor, currency) : '—'}</td><td className={`whitespace-nowrap px-4 py-4 text-right font-medium ${row.balance < 0 ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{money(row.balance, currency)}</td><td className="px-3 py-4">{(row.kind === 'purchase' || row.kind === 'debit' || (row.kind === 'credit' && !row.source_id && !!can('ledger.credit.update'))) ? <PurchaseActions row={row} accountId={account.id} canEdit={!!can('ledger.' + row.kind + '.update')} showAccountLink={false} showView={row.kind === 'purchase'} onEdit={() => setEditor({kind:row.kind as Kind,row})} /> : (!row.source_id && !row.details.cancelled_at && row.kind !== 'refund' && can(`ledger.${row.kind}.update`) && <button title="Editar movimiento" aria-label="Editar movimiento" onClick={() => setEditor({ kind: row.kind as Kind, row })}><Pencil size={16} /></button>)}</td></tr>)}
                        {!s?.rows.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Sin movimientos en {currency} para este período.</td></tr>}
                    </tbody><tfoot className="bg-slate-50 font-semibold dark:bg-slate-800"><tr><td className="px-4 py-4">Cierre del período</td><td className="whitespace-nowrap px-4 py-4 text-right">{money(s?.debit ?? 0, currency)}</td><td className="whitespace-nowrap px-4 py-4 text-right">{money(s?.credit ?? 0, currency)}</td><td className="whitespace-nowrap px-4 py-4 text-right">{money(s?.closing ?? 0, currency)}</td><td /></tr></tfoot></table></div></div>
                <p className="text-xs leading-5 text-slate-500">Un balance negativo representa saldo a favor. USD y RD$ se mantienen independientes. Las devoluciones aparecen en la columna crédito porque reducen el saldo a favor.</p></>}
            </> : <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center"><Wallet className="mx-auto mb-4 text-emerald-700" size={40} /><h2 className="text-xl font-semibold">{query.isPending ? 'Cargando cuenta…' : query.isError ? 'No se pudo cargar la cuenta' : accounts.length ? 'Selecciona una cuenta' : 'Crea tu primera cuenta'}</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{accounts.length ? 'Elige una cuenta para consultar sus balances y movimientos' : 'Registra un cliente o proveedor para comenzar.'}</p></div>}</section></div>
        {editor && account && <Movement key={editor.row?.id ?? editor.kind} editor={editor} account={account} accounts={accounts} can={can} close={() => setEditor(null)} />}
        {accountEditor && <AccountEditor account={accountEditor} close={() => setAccountEditor(null)} />}
    </AuthenticatedLayout>;
}

function AccountEditor({ account, close }: { account: Account | 'new'; close: () => void }) {
    const a = account === 'new' ? null : account;
    const form = useLedgerForm({ name: a?.name ?? '', document: a?.document ?? '', phone: a?.phone ?? '', notes: a?.notes ?? '' });
    return <Modal title={a ? 'Editar cuenta' : 'Nuevo cliente / proveedor'} close={close}><form className="space-y-4 p-5" onSubmit={e => { e.preventDefault(); a ? form.put(route('ledger.accounts.update', a.id), { onSuccess: close }) : form.post(route('ledger.accounts.store'), { onSuccess: close }); }}>{(['name', 'document', 'phone', 'notes'] as const).map((k, i) => <Field key={k} label={['Nombre *', 'Documento / RNC', 'Teléfono', 'Observaciones'][i]}><input className={input} required={k === 'name'} value={form.data[k]} onChange={e => form.setData(k, e.target.value)} /></Field>)}<Errors errors={form.errors} /><button disabled={form.processing} className={primary}>Guardar cuenta</button></form></Modal>;
}
function Errors({ errors }: { errors: Record<string, string> }) { return Object.keys(errors).length ? <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{Object.entries(errors).map(([key, text]) => <p key={key}>{text}</p>)}</div> : null; }
export function Movement({ editor, account, accounts, can, close }: { editor: { kind: Kind; row?: Row }; account: Account; accounts: Account[]; can: (p: string) => boolean | undefined; close: () => void }) {
    const row = editor.row;
    const form = useLedgerForm<Form>({ ...initial(editor.kind), ...(row ? { ...row.details, transport_price: row.details?.transport_price ?? (Number(row.details?.items?.[0]?.quantity) > 0 ? (Number(row.details?.transport ?? 0) / Number(row.details?.items?.[0]?.quantity)).toFixed(8) : '0'), kind: editor.kind, currency: row.currency, date: row.date, amount: (row.amount_minor / 100).toFixed(2), reference: row.reference ?? '', comment: row.comment ?? '', settlement_month: row.details.settlement_month ?? row.date.slice(0, 7), credit_used: ((row.details.credit_used_minor ?? 0) / 100).toFixed(2), version: row.version } : {}) });
    const d = form.data; const set = form.setData;
    const { auth } = usePage<PageProps>().props;
    const branch = auth.activeBranchOffice?.id_hash ?? '';
    const context = useQuery<SettlementSummary & { enabled: boolean }>({
        queryKey: ['ledger', auth.user.id, branch, 'payment-context', account.id, d.date, row?.id ?? '', row?.version ?? 0],
        enabled: d.kind === 'debit' && !!d.date,
        queryFn: async ({signal}) => {
            const response = await axios.get(route('ledger.payment-context', account.id), { params: {date: d.date, entry: row?.id}, signal, headers: ledgerHeaders(branch) });
            if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('Respuesta de sesión inválida');
            return response.data;
        },
        staleTime: 0,
    });
    const productPayment = d.kind === 'debit' && d.currency === 'USD' && !!context.data?.enabled;
    const group = context.data?.groups.find(g => g.month === d.settlement_month && g.product === d.product);
    const pending = group?.pending_minor ?? 0;
    const available = context.data?.available_minor ?? 0;
    const used = Math.round(Number(d.credit_used || 0) * 100);
    const cash = Math.round(Number(d.amount || 0) * 100);
    const applied = used + Math.min(cash, Math.max(0, pending - used));
    const surplus = Math.max(0, cash - Math.max(0, pending - used));
    const [useFavor, setUseFavor] = useState(Number(d.credit_used) > 0);

    const [withTransport, setWithTransport] = useState(() => !row || Number(form.data.transport_price) > 0);
    const total = d.items.reduce((sum, item) => sum + Math.round(Number(item.quantity) * Number(item.price) * 100) - Math.round(Number(item.discount) * 100), 0);
    const transportTotal = Math.round(Number(d.items[0]?.quantity ?? 0) * Number(d.transport_price) * 100);
    const cost = Math.round(total * Number(d.exchange_rate)) + transportTotal;
    const costReady = Number(d.exchange_rate) > 0 && d.items.every(item => Number(item.quantity) > 0 && Number(item.price) > 0) && total > 0;
    const quantity = d.items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const changeItem = (index: number, key: keyof Item, value: string) => set('items', d.items.map((item, i) => i === index ? { ...item, [key]: value } : item));
    const submit = (e: FormEvent) => { e.preventDefault(); row ? form.put(route('ledger.update', { account: account.id, entry: row.id }), { onSuccess: close, preserveScroll: true }) : form.post(route('ledger.store', account.id), { onSuccess: close, preserveScroll: true }); };
    return <Modal title={`${row ? 'Editar' : 'Registrar'} ${labels[d.kind].toLowerCase()} · ${account.name}`} close={close}><form onSubmit={submit} className="space-y-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Fecha *"><input className={input} type="date" required value={d.date} onChange={e => set('date', e.target.value)} /></Field>
            {d.kind === 'purchase'
                ? <Field label="Precio del Dollar: *"><input className={input} type="number" min="0.0001" step="0.0001" required value={d.exchange_rate} onChange={e => set('exchange_rate', e.target.value)} /></Field>
                : <Field label="Moneda"><select className={input} value={d.currency} onChange={e => { set('currency', e.target.value as Currency); set('credit_used', '0'); setUseFavor(false); }}><option value="USD">Dólar (USD$)</option><option value="DOP">Peso dominicano (RD$)</option></select></Field>}
            <div className="col-span-2 sm:col-span-1"><Field label="Factura / referencia"><input className={input} maxLength={100} value={d.reference} onChange={e => set('reference', e.target.value)} /></Field></div>
        </div>
        {d.kind === 'purchase' ? <>
            <Field label="Mes del producto *"><input type="month" required className={input} value={d.settlement_month} onChange={e => set('settlement_month', e.target.value)} /></Field>
            <div className="space-y-3">
                {d.items.map((item, i) => <section key={i} aria-label="Producto de la compra" className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/40 sm:p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Producto</h3><div className="text-right"><span className="text-xs text-slate-500 dark:text-slate-400">Total del producto</span><strong className="block text-lg tabular-nums">{money(Math.round(Number(item.quantity) * Number(item.price) * 100) - Math.round(Number(item.discount) * 100), 'USD')}</strong></div></div>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <Field label="Producto"><select aria-label="Producto" className={input} value={item.product} onChange={e => changeItem(i, 'product', e.target.value)}><option>Maíz</option><option>Soya</option></select></Field>
                        <Field label="Cantidad"><input aria-label="Cantidad del producto" className={input} type="number" min="0.0001" step="0.0001" required value={item.quantity} onChange={e => changeItem(i, 'quantity', e.target.value)} /></Field>
                        <Field label="Precio unitario"><input aria-label="Precio producto USD$" className={input} type="number" min="0.01" step="0.01" required value={item.price} onChange={e => changeItem(i, 'price', e.target.value)} /></Field>
                        <Field label="Descuento"><input aria-label="Descuento USD$" className={input} type="number" min="0" step="0.01" required value={item.discount} onChange={e => changeItem(i, 'discount', e.target.value)} /></Field>
                    </div>
                </section>)}
                {withTransport ? <section aria-label="Transporte de la compra" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 font-semibold"><Truck size={18} className="text-emerald-600 dark:text-emerald-400" />Transporte</h3><button type="button" className="inline-flex min-h-[44px] items-center gap-1 rounded-lg px-3 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" onClick={() => { set('transport_price', '0'); setWithTransport(false); }}><X size={16} />Quitar transporte</button></div>
                    <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-3">
                        <Field label="Cantidad automática"><input aria-label="Cantidad del transporte" className={input + ' opacity-70'} value={d.items[0]?.quantity ?? ''} readOnly /></Field>
                        <Field label="Precio unitario"><input aria-label="Precio transporte RD$" className={input} type="number" min="0" max="999999999.99" step="any" required value={d.transport_price} onChange={e => set('transport_price', e.target.value)} /></Field>
                        <div className="col-span-2 rounded-xl bg-slate-100 px-3 py-2 sm:col-span-1 dark:bg-slate-800"><span className="text-xs text-slate-500 dark:text-slate-400">Total del transporte</span><strong className="block break-words text-lg tabular-nums" aria-live="polite">{money(transportTotal, 'DOP')}</strong></div>
                    </div>
                </section> : <button type="button" className={secondary} onClick={() => setWithTransport(true)}><Plus size={16} />Agregar transporte</button>}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-live="polite" aria-atomic="true">
                <div className="min-w-0 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Crédito al proveedor<strong className="mt-1 block break-words text-base">{money(total, 'USD')}</strong></div>
                <div className="min-w-0 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800">Costo total del camión<strong className="mt-1 block break-words text-base">{costReady ? money(cost, 'DOP') : '—'}</strong></div>
                <div className="col-span-2 min-w-0 rounded-xl border border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100 sm:col-span-1">Costo Final<strong className="mt-1 block break-words text-lg">{costReady ? money(cost / quantity, 'DOP') : '—'}</strong><span className="text-xs">Por saco</span></div>

            </div></> : <>
            {d.kind === 'debit' && context.isPending && <p role="status" className="text-sm text-slate-500">Consultando saldo disponible…</p>}
            {d.kind === 'debit' && context.isError && <p role="alert" className="text-sm text-red-600">{ledgerError(context.error)} <button type="button" className="underline" onClick={() => context.refetch()}>Reintentar</button></p>}
            {productPayment && <section aria-label="Aplicación del pago" className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <div className="flex flex-wrap justify-between gap-2"><span className="text-sm font-semibold">Saldo a favor disponible a la fecha del pago</span><strong className="tabular-nums text-emerald-700 dark:text-emerald-300">{money(available, 'USD')}</strong></div>
                <div className="grid gap-3 sm:grid-cols-2"><Field label="Mes del producto *"><input type="month" required className={input} value={d.settlement_month} onChange={e => set('settlement_month', e.target.value)} /></Field><Field label="Producto del pago *"><select aria-label="Producto del pago" required className={input} value={d.product} onChange={e => set('product', e.target.value)}><option value="">Selecciona producto</option><option>Maíz</option><option>Soya</option></select></Field></div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pendiente de {d.product || 'este producto'} · {monthLabel(d.settlement_month)}: <strong>{money(pending, 'USD')}</strong></p>
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" className="rounded text-emerald-700" checked={useFavor} onChange={e => {setUseFavor(e.target.checked); set('credit_used', e.target.checked ? (Math.min(available, pending) / 100).toFixed(2) : '0');}} />Utilizar saldo a favor en este pago</label>
                {useFavor && <Field label="Saldo a favor a utilizar"><MoneyInput min="0" max={(Math.min(available, pending) / 100).toFixed(2)} className={input} value={d.credit_used} onChange={v => set('credit_used', v)} /></Field>}
            </section>}
            <Field label={`${productPayment ? 'Dinero nuevo' : 'Monto'} ${d.currency === 'USD' ? 'USD$' : 'RD$'} *`}><MoneyInput min={productPayment ? '0' : '0.01'} className={input} value={d.amount} onChange={value => set('amount', value)} /></Field>
            {productPayment && <div aria-live="polite" className="grid grid-cols-2 gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100"><div>Total del pago<strong className="mt-1 block break-words">{money(cash + used, 'USD')}</strong></div><div>Aplicado al mes/producto<strong className="mt-1 block break-words">{money(applied, 'USD')}</strong></div><div>Nuevo excedente<strong className="mt-1 block break-words">{money(surplus, 'USD')}</strong></div><div>Disponible después<strong className="mt-1 block break-words">{money(Math.max(0, available - (context.data?.general_pending_minor ?? 0) - used + (d.excess === 'keep' ? surplus : 0)), 'USD')}</strong></div><p className="col-span-2 text-xs">Saldo utilizado + dinero nuevo. Puedes indicar 0 en dinero nuevo para aplicar únicamente saldo disponible.</p></div>}
        </>}
        <Field label="Comentario / observación"><textarea className={input} rows={3} maxLength={4000} value={d.comment} onChange={e => set('comment', e.target.value)} /></Field>
        {d.kind === 'debit' && <><Field label="Si el abono supera el balance pendiente"><select className={input} value={d.excess} onChange={e => set('excess', e.target.value)}><option value="keep">Dejar el excedente como balance a favor</option><option value="refund">Devolver el excedente y registrar la devolución</option></select></Field><p className="text-xs text-slate-500">{productPayment ? 'El excedente se calcula contra el pendiente del mes y producto; no se aplica a otras compras.' : 'La devolución se calcula contra el balance a la fecha del abono.'} Al guardar se registra como dinero devuelto; no se realiza una transferencia bancaria.</p>
            {(can('ledger.credit.create') || d.linked) && <div className="space-y-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" className="rounded text-emerald-700" checked={d.linked} onChange={e => { set('linked', e.target.checked); if (!e.target.checked) { set('linked_mode', 'full'); set('linked_amount', ''); } }} />Crear también un crédito a otro proveedor</label>{d.linked && <><div className="grid gap-4 sm:grid-cols-2"><Field label="Proveedor destino *"><select className={input} required value={d.linked_account} onChange={e => set('linked_account', e.target.value)}><option value="">Seleccionar proveedor</option>{accounts.filter(a => a.id !== account.id).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field><Field label="Monto del crédito"><select className={input} value={d.linked_mode} onChange={e => set('linked_mode', e.target.value)}><option value="full">Monto completo del débito</option><option value="custom">Monto específico</option></select></Field></div>{d.linked_mode === 'custom' && <Field label={`Monto específico (${d.currency}) *`}><MoneyInput className={input} max={d.amount} value={d.linked_amount} onChange={value => set('linked_amount', value)} /></Field>}<Field label="Comentario del crédito vinculado"><textarea className={input} rows={2} value={d.linked_comment} onChange={e => set('linked_comment', e.target.value)} /></Field><p className="text-xs text-slate-500">El crédito vinculado corresponde únicamente al dinero nuevo del débito. Ambos movimientos se guardan juntos; puedes corregirlos desde este formulario.</p></>}</div>}</>}
        <Errors errors={form.errors} /><div className="grid grid-cols-2 gap-3 border-t pt-4 dark:border-slate-700 sm:flex sm:justify-end"><button type="button" className={secondary} disabled={form.processing} onClick={close}>Cancelar</button><button className={primary} disabled={form.processing || (d.kind === 'debit' && (context.isFetching || context.isPending || context.isError))}>{form.processing ? 'Guardando…' : row ? 'Guardar corrección' : 'Guardar movimiento'}</button></div>
    </form></Modal>;
}
