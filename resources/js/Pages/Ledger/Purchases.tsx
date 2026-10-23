import { monthLabel } from '@/lib/purchaseSettlements';
import { Dialog } from '@headlessui/react';
import { LayoutGrid, Table2, Plus, X } from 'lucide-react';
import PurchaseActions from '@/Components/PurchaseActions';
import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import AccountCombobox from '@/Components/AccountCombobox';
import { Movement, Account, Row } from './Index';
import { ledgerHeaders, ledgerError } from '@/lib/ledgerQuery';
import { PageProps } from '@/types';

type Filters = { account: string; period: string; from: string; to: string };
type Purchase = Row & { account_id: string; account_name: string };
type Data = { accounts: Account[]; filters: Filters; total: number; purchases: { data: Purchase[]; current_page: number; last_page: number; total: number } };
const money = (minor: number, currency = 'RD$') => `${currency} ${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(minor / 100)}`;
const button = 'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600 disabled:opacity-40';
const input = 'mt-1 w-full min-w-0 rounded-lg border-slate-300 bg-white text-base dark:border-slate-600 dark:bg-slate-950';
export default function Purchases(props: PageProps<Data>) {
    return <PurchasePage key={String(props.auth.user.id) + props.auth.activeBranchOffice?.id_hash} {...props} />;
}
function PurchasePage(props: PageProps<Data>) {
    const {auth} = props;
    const branch = auth.activeBranchOffice?.id_hash ?? '';
    const [criteria, setCriteria] = useState({...props.filters, page: 1});
    const [draft, setDraft] = useState(props.filters);
    const [choosingAccount, setChoosingAccount] = useState(false);
    const [view, setView] = useState<'cards' | 'table'>(() => {try {return localStorage.getItem('purchases-view') === 'table' ? 'table' : 'cards';} catch {return 'cards';}});
    const [editor, setEditor] = useState<{account: Account; row?: Purchase} | null>(null);
    const can = (permission: string) => auth.user.is_super_admin || auth.user.permissions?.includes(permission);
    const query = useQuery<Data>({
        queryKey: ['ledger', auth.user.id, branch, 'purchases', criteria],
        queryFn: async ({signal}) => {
            const response = await axios.get(route('ledger.purchases'), {params: criteria, signal, headers: ledgerHeaders(branch)});
            if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('Respuesta de sesión inválida');
            return response.data;
        },
        initialData: JSON.stringify(criteria) === JSON.stringify({...props.filters, page: 1}) ? props : undefined,
    });
    const data = query.data;
    const accounts = data?.accounts ?? props.accounts;
    const selected = accounts.find(a => a.id === draft.account);
    return <AuthenticatedLayout user={auth.user} header="Compras V2"><Head title="Compras V2" />
        <div className="mx-auto max-w-[1440px] space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Compras V2</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Compras de maíz y soya, transporte y costo final.</p></div>{can('ledger.purchase.create') && <button className={button + ' bg-emerald-700 text-white'} onClick={() => setChoosingAccount(true)}><Plus size={16} className="mr-2" />Nueva compra V2</button>}</div>

            <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" onSubmit={e => {e.preventDefault(); setCriteria({...draft, page: 1});}}>
                <AccountCombobox accounts={accounts} value={draft.account || null} onChange={id => {setDraft({...draft, account: id}); setCriteria({...criteria, account: id, page: 1});}} />
                <div className="grid items-end gap-3 sm:grid-cols-4"><label className="min-w-0 text-sm">Período<select className={input} value={draft.period} onChange={e => setDraft({...draft, period: e.target.value})}><option value="month">Este mes</option><option value="previous">Mes anterior</option><option value="quarter">Este trimestre</option><option value="custom">Personalizado</option></select></label>{draft.period === 'custom' && <><label className="min-w-0 text-sm">Desde<input className={input} type="date" required value={draft.from} onChange={e => setDraft({...draft, from: e.target.value})} /></label><label className="min-w-0 text-sm">Hasta<input className={input} type="date" required min={draft.from} value={draft.to} onChange={e => setDraft({...draft, to: e.target.value})} /></label></>}<button className={button}>Aplicar filtros</button></div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{draft.account ? 'Puedes registrar una compra para esta cuenta.' : 'Mostrando todas las cuentas. Puedes filtrar por cuenta o registrar una nueva compra.'}</p>
            </form>
            {query.isError ? <div role="alert">{ledgerError(query.error)} <button className={button} onClick={() => query.refetch()}>Reintentar</button></div> : !data ? <p role="status">Cargando compras…</p> : <>
                <div className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-200 p-4 dark:bg-slate-800"><span>{data.purchases.total} compras · {data.filters.from} — {data.filters.to}</span><strong>Total créditos: {money(data.total, 'USD$')}</strong></div>
                {query.isFetching && <p role="status" className="text-sm">Actualizando compras…</p>}
                <div role="group" aria-label="Vista de compras" className="flex justify-end gap-2">{(['cards','table'] as const).map(mode => <button key={mode} type="button" aria-pressed={view === mode} className={button + ' gap-2 ' + (view === mode ? 'bg-emerald-700 text-white' : '')} onClick={() => {setView(mode); try {localStorage.setItem('purchases-view',mode);} catch {}}}>{mode === 'cards' ? <LayoutGrid size={17}/> : <Table2 size={17}/>} {mode === 'cards' ? 'Tarjetas' : 'Tabla'}</button>)}</div>
                {view === 'table' ? <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700"><table className="w-full text-sm"><thead className="bg-slate-100 text-left dark:bg-slate-800"><tr>{['Fecha / referencia','Cuenta / producto','Cantidad','Crédito USD','Costo del camión','Costo por saco','Acciones'].map(label => <th key={label} className="whitespace-nowrap px-4 py-3">{label}</th>)}</tr></thead><tbody className="bg-white dark:bg-slate-900">{data.purchases.data.map(row => {const item = row.details.items?.[0]; const quantity = Number(item?.quantity ?? 0); const cost = row.details.cost_minor ?? 0; return <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700"><td className="whitespace-nowrap px-4 py-3">{row.date}<p className="text-xs text-slate-500 dark:text-slate-400">{row.reference || 'Sin referencia'}</p></td><td className="px-4 py-3"><Link className="font-semibold hover:underline" href={route('ledger.purchases.show',row.id)}>{row.account_name}</Link><p className="text-xs text-slate-500 dark:text-slate-400">{item?.product} · {monthLabel(row.details.settlement_month ?? row.date.slice(0, 7))}{row.details.cancelled_at && <span className="ml-2 text-red-500">Cancelada</span>}</p></td><td className="px-4 py-3 tabular-nums">{item?.quantity}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{money(row.amount_minor,'USD$')}</td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{money(cost)}</td><td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{quantity > 0 ? money(cost / quantity) : '—'}</td><td className="px-4 py-3"><PurchaseActions row={row} accountId={row.account_id} canEdit={!!can('ledger.purchase.update')} onEdit={() => {const account = accounts.find(a => a.id === row.account_id); if(account) setEditor({account,row});}} /></td></tr>;})}</tbody></table></div> :
                <div className="grid gap-4 lg:grid-cols-2">{data.purchases.data.map(row => {
                    const item = row.details.items?.[0]; const quantity = Number(item?.quantity ?? 0); const cost = row.details.cost_minor ?? 0;
                    return <article key={row.id} className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                        <div className="flex flex-wrap justify-between gap-2"><div className="min-w-0"><h2 className="break-words text-lg font-semibold">{row.account_name}</h2><p className="text-sm text-slate-500 dark:text-slate-400">{row.date.split('-').reverse().join('/')} · {item?.product ?? 'Compra V2'}</p><p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Mes del producto: {monthLabel(row.details.settlement_month ?? row.date.slice(0, 7))}</p></div><span className="break-all text-sm">{row.reference || 'Sin referencia'}</span></div>
                        <dl className="grid grid-cols-2 gap-3 text-sm"><div><dt>Cantidad</dt><dd className="break-words font-semibold">{item?.quantity}</dd></div><div><dt>Crédito USD</dt><dd className="break-words font-semibold">{money(row.amount_minor, 'USD$')}</dd></div><div><dt>Transporte</dt><dd className="break-words font-semibold">{money(Math.round(Number(row.details.transport ?? 0) * 100))}</dd></div><div><dt>Costo del camión</dt><dd className="break-words font-semibold">{money(cost)}</dd></div></dl>
                        <div className="rounded-lg bg-emerald-50 p-3 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">Costo Final <strong className="block break-words text-xl">{quantity > 0 ? money(cost / quantity) : '—'}</strong><span className="text-xs">Por saco</span></div>
                        {row.comment && <p className="whitespace-pre-wrap break-words text-sm">{row.comment}</p>}
                        <div className="flex items-center justify-between"><span className="text-sm font-semibold text-red-600 dark:text-red-400">{row.details.cancelled_at ? 'Cancelada' : ''}</span><PurchaseActions row={row} accountId={row.account_id} canEdit={!!can('ledger.purchase.update')} onEdit={() => {const account = accounts.find(a => a.id === row.account_id); if(account) setEditor({account,row});}} /></div>
                    </article>;
                })}</div>}
                {!data.purchases.total && <div className="rounded-xl border border-dashed border-slate-400 p-8 text-center">No hay compras en este período.</div>}
                {data.purchases.last_page > 1 && <nav aria-label="Páginas de compras" className="flex items-center justify-between gap-2"><button className={button} disabled={criteria.page <= 1 || query.isFetching} onClick={() => setCriteria({...criteria, page: criteria.page - 1})}>Anterior</button><span>{data.purchases.current_page} / {data.purchases.last_page}</span><button className={button} disabled={criteria.page >= data.purchases.last_page || query.isFetching} onClick={() => setCriteria({...criteria, page: criteria.page + 1})}>Siguiente</button></nav>}
            </>}
        </div>
        <Dialog open={choosingAccount} onClose={() => setChoosingAccount(false)} className="relative z-50">
            <div className="fixed inset-0 bg-slate-950/70" aria-hidden="true" />
            <div className="fixed inset-0 overflow-y-auto p-4"><div className="flex min-h-full items-center justify-center">
                <Dialog.Panel className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 pb-[min(320px,40dvh)] text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <div className="mb-4 flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-semibold">Nueva compra V2</Dialog.Title><button type="button" className={button} aria-label="Cerrar" onClick={() => setChoosingAccount(false)}><X size={18}/></button></div>
                    <Dialog.Description className="mb-4 text-sm text-slate-500 dark:text-slate-400">Elige la cuenta para registrar la compra.</Dialog.Description>
                    <AccountCombobox accounts={accounts} value={null} onChange={id => {const account = accounts.find(a => a.id === id); if(account) {setChoosingAccount(false); setEditor({account});}}}/>
                    {!accounts.length && <p className="mt-4 text-sm">No hay cuentas disponibles. Crea una cuenta desde Estados de cuenta para registrar compras.</p>}
                </Dialog.Panel>
            </div></div>
        </Dialog>
        {editor && <Movement editor={{kind: 'purchase', row: editor.row}} account={editor.account} accounts={accounts} can={can} close={() => setEditor(null)} />}
    </AuthenticatedLayout>;
}
