import { Link } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { MoreVertical, Eye, Pencil, Ban, Wallet } from 'lucide-react';
import { Row } from '@/Pages/Ledger/Index';
import { useLedgerForm } from '@/lib/ledgerQuery';

export default function PurchaseActions({row, accountId, canEdit, onEdit, showAccountLink = true, showView = true}: {row: Row; accountId: string; canEdit: boolean; onEdit: () => void; showAccountLink?: boolean; showView?: boolean}) {
    const debit = row.kind === 'debit';
    const credit = row.kind === 'credit';
    const menu = useRef<HTMLDetailsElement>(null);
    const [position, setPosition] = useState({top: 0, left: 0});
    const [confirming, setConfirming] = useState(false);
    const form = useLedgerForm({version: row.version});
    const cancelled = !!row.details.cancelled_at;
    const close = () => {if (menu.current) menu.current.open = false;};
    useEffect(() => {
        window.addEventListener('scroll', close, true);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('scroll', close, true);
            window.removeEventListener('resize', close);
        };
    }, []);
    const action = 'flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800';
    return <><details ref={menu} className="relative shrink-0" onToggle={e => {
        if (!e.currentTarget.open) return;
        const rect = e.currentTarget.querySelector('summary')!.getBoundingClientRect();
        const height = 12 + 44 * ((showView ? 1 : 0) + (canEdit && !cancelled ? 2 : 0) + (showAccountLink ? 1 : 0));
        setPosition({left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)), top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4});
    }} onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget as Node)) close();}} onKeyDown={e => {if (e.key === 'Escape') close();}}>
        <summary aria-label={debit ? 'Acciones del débito' : credit ? 'Acciones del crédito' : 'Acciones de compra'} className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden"><MoreVertical size={20} /></summary>
        <div style={position} className="fixed z-40 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-600 dark:bg-slate-900">
            {showView && <Link className={action} href={route('ledger.purchases.show',row.id)} onClick={close}><Eye size={17}/>Ver</Link>}
            {canEdit && !cancelled && <button type="button" className={action} onClick={() => {close(); onEdit();}}><Pencil size={17}/>Editar</button>}
            {canEdit && !cancelled && <button type="button" className={action + ' text-red-600 dark:text-red-400'} onClick={() => {close(); setConfirming(true);}}><Ban size={17}/>Cancelar</button>}
            {showAccountLink && <Link className={action} href={route('ledger.index',{account:accountId,period:'custom',from:row.date,to:row.date})} onClick={close}><Wallet size={17}/>Estado de cuenta</Link>}
        </div>
    </details>
    {confirming && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><section role="alertdialog" aria-modal="true" aria-labelledby={'cancel-'+row.id} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900"><h2 id={'cancel-'+row.id} className="text-lg font-semibold">{debit ? '¿Cancelar este débito?' : credit ? '¿Cancelar este crédito?' : '¿Cancelar esta compra?'}</h2><p className="mt-2 text-sm">{debit ? 'Se anulará el abono junto con su crédito vinculado y devolución, si existen. Los balances se actualizarán y quedará registro de la cancelación.' : credit ? 'Se quitará el crédito del balance. Quedará registrado como cancelado y no podrá editarse.' : 'Se quitará su crédito del balance. La compra quedará registrada como cancelada y no podrá editarse.'}</p>{Object.values(form.errors).map((error,i)=><p key={i} role="alert" className="mt-2 text-sm text-red-600">{error}</p>)}<div className="mt-5 flex justify-end gap-3"><button autoFocus type="button" disabled={form.processing} className="min-h-[44px] rounded-lg border px-4" onClick={()=>setConfirming(false)}>Volver</button><button type="button" disabled={form.processing} className="min-h-[44px] rounded-lg bg-red-700 px-4 text-white disabled:opacity-50" onClick={()=>{form.setData('version',row.version);form.post(route(debit ? 'ledger.debits.cancel' : credit ? 'ledger.credits.cancel' : 'ledger.purchases.cancel',row.id),{onSuccess:()=>setConfirming(false)});}}>{form.processing?'Cancelando…':debit ? 'Cancelar débito' : credit ? 'Cancelar crédito' : 'Cancelar compra'}</button></div></section></div>}
    </>;
}
