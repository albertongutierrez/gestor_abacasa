import PurchaseActions from '@/Components/PurchaseActions';
import { Download, FileText, ArrowLeft, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Head, Link } from '@inertiajs/react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Movement, Account, Row } from './Index';
import { ledgerHeaders, ledgerError } from '@/lib/ledgerQuery';
import { PageProps } from '@/types';

type Data = { issuer: {name: string; logo: string; lines: string[]}; account: Account; purchase: Row };
const money = (minor: number, currency = 'RD$') => `${currency} ${new Intl.NumberFormat('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(minor / 100)}`;
const button = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-600';
const panel = 'min-w-0 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
export default function PurchaseShow(props: PageProps<Data>) {
    const {auth} = props;
    const branch = auth.activeBranchOffice?.id_hash ?? '';
    const [editing, setEditing] = useState(false);
    const can = (permission: string) => auth.user.is_super_admin || auth.user.permissions?.includes(permission);
    const query = useQuery<Data>({
        queryKey: ['ledger', auth.user.id, branch, 'purchase', props.purchase.id],
        queryFn: async ({signal}) => {
            const response = await axios.get(route('ledger.purchases.show', props.purchase.id), {signal, headers: ledgerHeaders(branch)});
            if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('Respuesta de sesión inválida');
            return response.data;
        },
        initialData: {account: props.account, purchase: props.purchase, issuer: props.issuer},
    });
    const {account, purchase, issuer} = query.data;
    const item = purchase.details.items?.[0];
    const hasDiscount = Number(item?.discount ?? 0) > 0;
    const quantity = Number(item?.quantity ?? 0);
    const transport = Math.round(Number(purchase.details.transport ?? 0) * 100);
    const cost = purchase.details.cost_minor ?? 0;
    return <AuthenticatedLayout user={auth.user} header="Detalle de compra V2"><Head title="Detalle de compra V2" />
        <div className="mx-auto max-w-5xl space-y-4">
            <nav aria-label="Acciones de compra" className="flex items-center justify-between gap-2">
                <Link title="Volver a Compras V2" aria-label="Volver a Compras V2" className={button + ' shrink-0 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800'} href={route('ledger.purchases')}><ArrowLeft size={16} aria-hidden="true" /><span className="hidden lg:inline">Volver a Compras V2</span></Link>
                <div className="flex items-center gap-2">
                    <Link title="Estado de cuenta" aria-label="Estado de cuenta" className={button} href={route('ledger.index', {account: account.id, period: 'custom', from: purchase.date, to: purchase.date})}><Wallet size={16} /><span className="hidden sm:inline">Estado de cuenta</span></Link>
                    {can('ledger.export') && <a title="Ver PDF" aria-label="Ver PDF" className={button + ' bg-emerald-700 text-white'} href={route('ledger.purchases.print', purchase.id)} target="_blank" rel="noreferrer"><FileText size={16} /><span className="hidden sm:inline">Ver PDF</span></a>}
                    {can('ledger.export') && <a title="Descargar PDF" aria-label="Descargar PDF" className={button} href={route('ledger.purchases.print', {entry: purchase.id, download: 1})}><Download size={16} /><span className="hidden sm:inline">Descargar PDF</span></a>}
                    {can('ledger.purchase.update') && !purchase.details.cancelled_at && <PurchaseActions row={purchase} accountId={account.id} canEdit={true} showView={false} showAccountLink={false} onEdit={() => setEditing(true)} />}
                </div>
            </nav>
            {query.isError ? <div role="alert" className={panel}>{ledgerError(query.error)} <button className={button} onClick={() => query.refetch()}>Reintentar</button></div> : <>
                <article className="purchase-invoice" aria-label="Comprobante de compra V2">
                    <header className="invoice-heading">
                        <div className="invoice-brand"><img src={issuer.logo} alt={issuer.name} /><div><strong>{issuer.name}</strong>{issuer.lines.map((line, index) => <p key={index}>{line}</p>)}</div></div>
                        <div className="invoice-reference"><h1>COMPRA V2</h1>{purchase.details.cancelled_at && <strong className="text-red-600">CANCELADA</strong>}<p>{purchase.reference || 'Sin referencia'}</p><span>Fecha: {purchase.date.split('-').reverse().join('/')}</span></div>
                    </header>
                    <section className="invoice-parties"><div><span className="invoice-label">CUENTA / PROVEEDOR</span><h2>{account.name}</h2><p>Documento / RNC: {account.document || '—'}</p><p>Teléfono: {account.phone || '—'}</p></div><div><span className="invoice-label">DATOS DE LA COMPRA</span><p>Moneda del crédito: <strong>USD</strong></p><p>Precio del dólar: <strong>{money(Number(purchase.details.exchange_rate ?? 0) * 100)}</strong></p></div></section>
                    <table className="invoice-lines"><thead><tr><th>Descripción</th><th>Cantidad</th><th>Precio</th>{hasDiscount && <th>Descuento</th>}<th>Importe</th></tr></thead><tbody>
                        <tr><td data-label="Descripción"><strong>{item?.product || 'Producto'}</strong></td><td data-label="Cantidad">{item?.quantity} sacos</td><td data-label="Precio">{money(Number(item?.price ?? 0) * 100, 'USD$')}</td>{hasDiscount && <td data-label="Descuento">{money(Number(item?.discount ?? 0) * 100, 'USD$')}</td>}<td data-label="Importe"><strong>{money(purchase.amount_minor, 'USD$')}</strong></td></tr>
                        {transport > 0 && <tr><td data-label="Descripción"><strong>Transporte</strong></td><td data-label="Cantidad">{item?.quantity}</td><td data-label="Precio">{money(quantity > 0 ? transport / quantity : 0)}</td>{hasDiscount && <td data-label="Descuento">—</td>}<td data-label="Importe"><strong>{money(transport)}</strong></td></tr>}
                    </tbody></table>
                    <div className="invoice-bottom"><section className="invoice-notes"><h2>Observaciones</h2><p>{purchase.comment || 'Sin observaciones.'}</p></section><dl className="invoice-totals"><div><dt>Crédito al proveedor</dt><dd>{money(purchase.amount_minor, 'USD$')}</dd></div><div><dt>Costo total del camión</dt><dd>{money(cost)}</dd></div><div className="invoice-final"><dt>Costo Final<small>Por saco</small></dt><dd>{quantity > 0 ? money(cost / quantity) : '—'}</dd></div></dl></div>
                    <footer>El crédito se registra en USD. La tasa y el transporte se utilizan únicamente para calcular el costo.</footer>
                </article>
            </>}
        </div>
        {editing && !query.isError && <Movement key={purchase.version} editor={{kind: 'purchase', row: purchase}} account={account} accounts={[account]} can={can} close={() => setEditing(false)} />}
    </AuthenticatedLayout>;
}
