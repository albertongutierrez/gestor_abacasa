import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { confirmAction } from '@/lib/notify';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit, Plus, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from 'react';
import { RoleRecord } from './RoleForm';

type PaginatedRoles = {
    data: RoleRecord[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Props = PageProps<{
    roles: PaginatedRoles;
    filters: { search: string; status: string };
}>;

export default function Index({ auth, roles, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [status, setStatus] = useState(filters.status ?? '');
    const permissions = new Set(auth.user.permissions ?? []);
    const canManage = permissions.has('roles.manage');

    const filtersReady = useRef(false);


    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('settings.roles.index'), { search, status }, { preserveState: true, replace: true });
    };




    useEffect(() => {


        if (!filtersReady.current) {


            filtersReady.current = true;


            return;


        }





        const timeout = window.setTimeout(() => {


                    router.get(route('settings.roles.index'), { search, status }, { preserveState: true, replace: true });


        }, 300);





        return () => window.clearTimeout(timeout);


    }, [search, status]);

    return (
        <AuthenticatedLayout user={auth.user} activeBranchOffice={auth.activeBranchOffice} header="Roles y permisos">
            <Head title="Roles y permisos" />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
                            <ShieldCheck className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            Roles y permisos
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Administra roles y su relacion con los permisos del sistema.</p>
                    </div>
                    {canManage && (
                        <Link
                            href={route('settings.roles.create')}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo rol
                        </Link>
                    )}
                </div>

                <form onSubmit={submit} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 md:grid-cols-[1fr_180px_auto]">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoComplete="off"
                        placeholder="Buscar por nombre, codigo o descripcion"
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                    </select>
                </form>

                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Rol</th>
                                    <th className="px-4 py-3">Permisos</th>
                                    <th className="px-4 py-3">Usuarios</th>
                                    <th className="px-4 py-3">Estado</th>
                                    {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {roles.data.length === 0 && (
                                    <tr>
                                        <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            No hay roles registrados.
                                        </td>
                                    </tr>
                                )}

                                {roles.data.map((role) => (
                                    <tr key={role.id_hash} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                                                    <ShieldCheck className="h-5 w-5 text-slate-400" />
                                                </span>
                                                <div>
                                                    <div className="flex flex-wrap items-center gap-2 font-medium text-slate-950 dark:text-white">
                                                        {role.name}
                                                        {role.is_system && (
                                                            <span className="rounded-md bg-sky-50 px-2 py-1 text-xs font-semibold text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                                                                Sistema
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{role.slug}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-semibold text-slate-950 dark:text-white">{role.permissions_count}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{role.users_count}</td>
                                        <td className="px-4 py-3">
                                            <span className={`rounded-md px-2 py-1 text-xs font-semibold ${role.is_active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                                                {role.is_active ? 'Activo' : 'Inactivo'}
                                            </span>
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                {role.can_manage ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Link href={route('settings.roles.edit', role.id_hash)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Editar
                                                        </Link>
                                                        {!role.is_system && role.users_count === 0 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    confirmAction('Eliminar este rol?', () => router.delete(route('settings.roles.destroy', role.id_hash)))
                                                                }}
                                                                className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                Eliminar
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Fijo del sistema</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            Mostrando {roles.from ?? 0} a {roles.to ?? 0} de {roles.total}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {roles.links.map((link, index) => (
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
