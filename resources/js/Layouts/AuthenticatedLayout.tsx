import { PropsWithChildren, ReactNode, useEffect, useState } from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import { Building2, Home, Layers3, LogOut, Menu, ShieldCheck, Store, UserCircle, Users, X } from 'lucide-react';
import ThemeToggle from '@/Components/ThemeToggle';
import { notify } from '@/lib/notify';
import { BranchOfficeSummary, PageProps, User } from '@/types';

export default function AuthenticatedLayout({ children, header }: PropsWithChildren<{ user: User; activeBranchOffice?: BranchOfficeSummary | null; header?: ReactNode }>) {
    const { props, url } = usePage<PageProps>();
    const { auth, appName, flash, errors } = props;
    const [open, setOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const can = (permission: string) => auth.user.is_super_admin || auth.user.permissions?.includes(permission);
    useEffect(() => { if (flash?.success) notify(flash.success, 'success'); }, [flash]);
    useEffect(() => { if (Object.keys(errors).length) notify(Object.values(errors).join(' ')); }, [errors]);
    useEffect(() => { setOpen(false); }, [url]);
    useEffect(() => {
        const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close);
    }, []);
    const entries = [
        { label: 'Inicio', name: 'dashboard', path: '/dashboard', icon: Home, visible: true },
        { label: 'Estados de cuenta', name: 'ledger.index', path: '/ledger', icon: Layers3, visible: can('ledger.view') },
        { label: 'Compras V2', name: 'ledger.purchases', path: '/ledger/purchases', icon: Layers3, visible: can('ledger.view') },
        { label: 'Empresas', name: 'settings.offices.index', path: '/settings/offices', icon: Building2, visible: auth.user.is_super_admin },
        { label: 'Sucursales', name: 'settings.branch-offices.index', path: '/settings/branch-offices', icon: Store, visible: can('settings.branch-offices.view') },
        { label: 'Usuarios', name: 'settings.users.index', path: '/settings/users', icon: Users, visible: can('users.view') },
        { label: 'Roles y permisos', name: 'settings.roles.index', path: '/settings/roles', icon: ShieldCheck, visible: can('roles.view') },
    ];
    return <div className="app-shell min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {open && <button aria-label="Cerrar menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
        <aside className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex`}>
            <div className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-5 dark:border-slate-800">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-slate-200"><img src={auth.activeBranchOffice?.office_compact_logo_url || '/brand/favicon.png'} alt={auth.activeBranchOffice?.office_name || 'ABACASA'} className="h-8 w-8 object-contain" /></span>
                <span className="min-w-0 break-words font-semibold">{appName}</span>
                <button title="Cerrar menu" onClick={() => setOpen(false)} className="ml-auto lg:hidden"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4">
                <label htmlFor="branch-switcher" className="mb-2 block text-xs font-semibold uppercase text-slate-500">Empresa / sucursal</label>
                <select id="branch-switcher" className="w-full rounded-md border-slate-300 bg-white text-sm dark:border-slate-700 dark:bg-slate-950" value={auth.activeBranchOffice?.id_hash ?? ''} disabled={switching || !auth.availableBranchOffices.length} onChange={event => {
                    setSwitching(true);
                    router.patch(route('settings.active-branch-office.update'), { branch_office: event.target.value }, { preserveState: false, onFinish: () => setSwitching(false) });
                }}>
                    {!auth.activeBranchOffice && <option value="">Sin sucursal</option>}
                    {auth.availableBranchOffices.map(branch => <option key={branch.id_hash} value={branch.id_hash}>{branch.office_name} / {branch.name}</option>)}
                </select>
            </div>
            <nav data-navigation-menu className="flex-1 space-y-1 overflow-y-auto px-3">
                {entries.filter(entry => entry.visible).map(({ name, label, path, icon: Icon }) => <Link key={name} href={route(name)} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ${(path === '/ledger' ? url.split('?')[0] === path : url.startsWith(path)) ? 'bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon className="h-4 w-4" />{label}</Link>)}
            </nav>
            <div className="space-y-2 border-t border-slate-200 p-4 dark:border-slate-800">
                <Link href={route('profile.edit')} className="flex min-w-0 items-center gap-3 text-sm"><UserCircle className="h-5 w-5 shrink-0" /><span className="truncate">{auth.user.name}</span></Link>
                <Link href={route('logout')} method="post" as="button" className="flex items-center gap-3 py-2 text-sm text-slate-500"><LogOut className="h-4 w-4" />Cerrar sesion</Link>
            </div>
        </aside>
        <div className="min-w-0 lg:pl-64">
            <header className="app-gutter flex min-h-16 items-center gap-3 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                <button title="Abrir menu" onClick={() => setOpen(true)} className="rounded-md border border-slate-300 p-2 dark:border-slate-700 lg:hidden"><Menu className="h-5 w-5" /></button>
                <div className="min-w-0 flex-1 break-words text-sm font-semibold">{header || 'Inicio'}</div><ThemeToggle />
            </header>
            <main className="app-gutter min-w-0 py-4 sm:py-8">{children}</main>
        </div>
    </div>;
}
