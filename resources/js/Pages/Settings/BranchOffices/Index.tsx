import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { confirmAction } from '@/lib/notify';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from 'react';
import { OfficeOption } from './BranchOfficeForm';

type BranchOffice = {
    id: number;
    id_hash: string;
    office_id: number;
    office_name: string | null;
    name: string;
    code: string;
    phone: string | null;
    mobile_phone: string | null;
    email: string | null;
    is_main: boolean;
    is_active: boolean;
};

type PaginatedBranchOffices = {
    data: BranchOffice[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Props = PageProps<{
    branchOffices: PaginatedBranchOffices;
    offices: OfficeOption[];
    filters: { search: string; status: string; office_id: string | number };
}>;

export default function Index({ auth, branchOffices, offices, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const [officeId, setOfficeId] = useState(String(filters.office_id ?? ''));
    const permissions = new Set(auth.user.permissions ?? []);
    const canCreate = permissions.has('settings.branch-offices.create');
    const canUpdate = permissions.has('settings.branch-offices.update');
    const canDelete = permissions.has('settings.branch-offices.delete');
    const canManage = canUpdate || canDelete;

    const filtersReady = useRef(false);


    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('settings.branch-offices.index'), { search, status, office_id: officeId }, { preserveState: true, replace: true });
    };




    useEffect(() => {


        if (!filtersReady.current) {


            filtersReady.current = true;


            return;


        }





        const timeout = window.setTimeout(() => {


                    router.get(route('settings.branch-offices.index'), { search, status, office_id: officeId }, { preserveState: true, replace: true });


        }, 300);





        return () => window.clearTimeout(timeout);


    }, [search, status]);

    return (
        <AuthenticatedLayout user={auth.user} activeBranchOffice={auth.activeBranchOffice} header="Sucursales">
            <Head title="Sucursales" />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
                            <MapPin className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            Sucursales
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administra las sucursales por empresa y sus datos operativos.</p>
                    </div>
                    {canCreate && (
                        <Link
                            href={route('settings.branch-offices.create')}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva sucursal
                        </Link>
                    )}
                </div>

                <form onSubmit={submit} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-[1fr_220px_160px_auto]">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoComplete="off"
                        placeholder="Buscar por nombre, codigo, empresa o contacto"
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    <select
                        value={officeId}
                        onChange={(event) => setOfficeId(event.target.value)}
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="">Todas las empresas</option>
                        {offices.map((office) => (
                            <option key={office.id} value={office.id}>
                                {office.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="">Todas</option>
                        <option value="active">Activas</option>
                        <option value="inactive">Inactivas</option>
                    </select>
                </form>

                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Sucursal</th>
                                    <th className="px-4 py-3">Empresa</th>
                                    <th className="px-4 py-3">Contacto</th>
                                    <th className="px-4 py-3">Estado</th>
                                    {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {branchOffices.data.length === 0 && (
                                    <tr>
                                        <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            No hay sucursales registradas.
                                        </td>
                                    </tr>
                                )}

                                {branchOffices.data.map((branchOffice) => (
                                    <tr key={branchOffice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                                                    <MapPin className="h-5 w-5 text-slate-400" />
                                                </span>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-950 dark:text-white">
                                                        {branchOffice.name}
                                                        {branchOffice.is_main && (
                                                            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                                                Principal
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{branchOffice.code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{branchOffice.office_name ?? '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            <div>Tel: {branchOffice.phone ?? '-'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">Cel: {branchOffice.mobile_phone ?? '-'}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">{branchOffice.email ?? '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${branchOffice.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                {branchOffice.is_active ? 'Activa' : 'Inactiva'}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canUpdate && (
                                                        <Link href={route('settings.branch-offices.edit', branchOffice.id_hash)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Editar
                                                        </Link>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                confirmAction('Eliminar esta sucursal?', () => router.delete(route('settings.branch-offices.destroy', branchOffice.id_hash)))
                                                            }}
                                                            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                            Eliminar
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Mostrando {branchOffices.from ?? 0} a {branchOffices.to ?? 0} de {branchOffices.total}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {branchOffices.links.map((link, index) => (
                                <button
                                    key={`${link.label}-${index}`}
                                    disabled={!link.url}
                                    onClick={() => link.url && router.get(link.url)}
                                    className={`min-h-9 rounded-md border px-3 text-sm ${link.active ? 'border-slate-950 bg-slate-950 text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100' : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800'} disabled:cursor-not-allowed disabled:opacity-40`}
                                    dangerouslySetInnerHTML={{ __html: link.label }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
