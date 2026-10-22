import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { confirmAction } from '@/lib/notify';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Building2, Edit, Plus, Search, Trash2 } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from 'react';

type Office = {
    id: number;
    id_hash: string;
    name: string;
    slogan: string | null;
    tax_id: string | null;
    logo_url: string | null;
    effective_compact_logo_url: string | null;
    branch_offices_count: number | null;
};

type PaginatedOffices = {
    data: Office[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Props = PageProps<{
    offices: PaginatedOffices;
    filters: { search: string };
}>;

export default function Index({ auth, offices, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const permissions = new Set(auth.user.permissions ?? []);
    const canCreate = permissions.has('settings.offices.create');
    const canUpdate = permissions.has('settings.offices.update');
    const canDelete = permissions.has('settings.offices.delete');
    const canManage = canUpdate || canDelete;

    const filtersReady = useRef(false);


    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('settings.offices.index'), { search }, { preserveState: true, replace: true });
    };




    useEffect(() => {


        if (!filtersReady.current) {


            filtersReady.current = true;


            return;


        }





        const timeout = window.setTimeout(() => {


                    router.get(route('settings.offices.index'), { search }, { preserveState: true, replace: true });


        }, 300);





        return () => window.clearTimeout(timeout);


    }, [search]);

    return (
        <AuthenticatedLayout user={auth.user} activeBranchOffice={auth.activeBranchOffice} header="Empresas">
            <Head title="Empresas" />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
                            <Building2 className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            Empresas
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administra nombre, slogan, documento fiscal y logo de cada empresa.</p>
                    </div>
                    {canCreate && (
                        <Link
                            href={route('settings.offices.create')}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
                        >
                            <Plus className="h-4 w-4" />
                            Nueva empresa
                        </Link>
                    )}
                </div>

                <form onSubmit={submit} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-[1fr_auto]">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoComplete="off"
                        placeholder="Buscar por nombre, slogan o RNC/Cedula"
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                </form>

                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Empresa</th>
                                    <th className="px-4 py-3">RNC / Cedula</th>
                                    <th className="px-4 py-3">Sucursales</th>
                                    {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {offices.data.length === 0 && (
                                    <tr>
                                        <td colSpan={canManage ? 4 : 3} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            No hay empresas registradas.
                                        </td>
                                    </tr>
                                )}

                                {offices.data.map((office) => (
                                    <tr key={office.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                                                    {office.logo_url ? <img src={office.logo_url} alt={office.name} className="h-full w-full object-contain p-1" /> : <Building2 className="h-5 w-5 text-slate-400" />}
                                                </span>
                                                <div>
                                                    <div className="font-medium text-slate-950 dark:text-white">{office.name}</div>
                                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                        <span>{office.slogan ?? 'Sin slogan'}</span>
                                                        {office.effective_compact_logo_url && (
                                                            <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                                                <img src={office.effective_compact_logo_url} alt={`${office.name} compacto`} className="h-full w-full object-contain p-0.5" />
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{office.tax_id ?? '-'}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{office.branch_offices_count ?? 0}</td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canUpdate && (
                                                        <Link href={route('settings.offices.edit', office.id_hash)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Editar
                                                        </Link>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                confirmAction('Eliminar esta empresa?', () => router.delete(route('settings.offices.destroy', office.id_hash)))
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
                            Mostrando {offices.from ?? 0} a {offices.to ?? 0} de {offices.total}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {offices.links.map((link, index) => (
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
