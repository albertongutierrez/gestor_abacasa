import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { confirmAction } from '@/lib/notify';
import { PageProps } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { Edit, Plus, Search, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { FormEvent, useState, useEffect, useRef } from 'react';
import { BranchOfficeOption, RoleOption, ManagedUser } from './UserForm';

type PaginatedUsers = {
    data: ManagedUser[];
    links: { url: string | null; label: string; active: boolean }[];
    from: number | null;
    to: number | null;
    total: number;
};

type Props = PageProps<{
    users: PaginatedUsers;
    options: {
        roles: RoleOption[];
        branchOffices: BranchOfficeOption[];
    };
    filters: { search: string; role_id: string | number; branch_office_id: string | number };
}>;

export default function Index({ auth, users, options, filters }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [roleId, setRoleId] = useState(String(filters.role_id ?? ''));
    const [branchOfficeId, setBranchOfficeId] = useState(String(filters.branch_office_id ?? ''));
    const permissions = new Set(auth.user.permissions ?? []);
    const canCreate = permissions.has('users.create');
    const canUpdate = permissions.has('users.update');
    const canDelete = permissions.has('users.delete');
    const canManage = canUpdate || canDelete;

    const filtersReady = useRef(false);


    const submit = (event: FormEvent) => {
        event.preventDefault();
        router.get(route('settings.users.index'), {
            search,
            role_id: roleId,
            branch_office_id: branchOfficeId,
        }, { preserveState: true, replace: true });
    };




    useEffect(() => {


        if (!filtersReady.current) {


            filtersReady.current = true;


            return;


        }





        const timeout = window.setTimeout(() => {


                    router.get(route('settings.users.index'), {


                        search,


                        role_id: roleId,


                        branch_office_id: branchOfficeId,


                    }, { preserveState: true, replace: true });


        }, 300);





        return () => window.clearTimeout(timeout);


    }, [search, roleId, branchOfficeId]);

    return (
        <AuthenticatedLayout user={auth.user} activeBranchOffice={auth.activeBranchOffice} header="Usuarios">
            <Head title="Usuarios" />

            <div className="space-y-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white">
                            <UserCog className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                            Usuarios
                        </h1>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Crea usuarios, asigna roles y define las sucursales donde pueden trabajar.</p>
                    </div>
                    {canCreate && (
                        <Link
                            href={route('settings.users.create')}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-800 dark:ring-1 dark:ring-slate-700"
                        >
                            <Plus className="h-4 w-4" />
                            Nuevo usuario
                        </Link>
                    )}
                </div>

                <form onSubmit={submit} className="grid gap-3 rounded-md border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-[1fr_210px_250px_auto]">
                    <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        autoComplete="off"
                        placeholder="Buscar por nombre, correo, rol o sucursal"
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    <select
                        value={roleId}
                        onChange={(event) => setRoleId(event.target.value)}
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="">Todos los roles</option>
                        {options.roles.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                        ))}
                    </select>
                    <select
                        value={branchOfficeId}
                        onChange={(event) => setBranchOfficeId(event.target.value)}
                        className="min-h-10 rounded-md border-slate-300 bg-white text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                        <option value="">Todas las sucursales</option>
                        {options.branchOffices.map((branchOffice) => (
                            <option key={branchOffice.id_hash} value={branchOffice.id}>
                                {branchOffice.name} ({branchOffice.code})
                            </option>
                        ))}
                    </select>
                </form>

                <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/70 dark:text-slate-400">
                                <tr>
                                    <th className="px-4 py-3">Usuario</th>
                                    <th className="px-4 py-3">Roles</th>
                                    <th className="px-4 py-3">Sucursal activa</th>
                                    <th className="px-4 py-3">Sucursales</th>
                                    {canManage && <th className="px-4 py-3 text-right">Acciones</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                {users.data.length === 0 && (
                                    <tr>
                                        <td colSpan={canManage ? 5 : 4} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                                            No hay usuarios registrados.
                                        </td>
                                    </tr>
                                )}

                                {users.data.map((managedUser) => (
                                    <tr key={managedUser.id_hash} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                                                    <UserCog className="h-5 w-5 text-slate-400" />
                                                </span>
                                                <div>
                                                    <div className="font-medium text-slate-950 dark:text-white">{managedUser.name}</div>
                                                    <div className="text-xs text-slate-500 dark:text-slate-400">{managedUser.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1.5">
                                                {managedUser.roles.map((role) => (
                                                    <span key={role.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                                        <ShieldCheck className="h-3 w-3" />
                                                        {role.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            {managedUser.active_branch_office_name ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                                            <span className="font-semibold text-slate-950 dark:text-white">{managedUser.branch_offices.length}</span>
                                            <span className="text-slate-500 dark:text-slate-400"> asignada(s)</span>
                                        </td>
                                        {canManage && (
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    {canUpdate && (
                                                        <Link href={route('settings.users.edit', managedUser.id_hash)} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                                                            <Edit className="h-3.5 w-3.5" />
                                                            Editar
                                                        </Link>
                                                    )}
                                                    {canDelete && managedUser.id !== auth.user.id && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                confirmAction('Eliminar este usuario?', () => router.delete(route('settings.users.destroy', managedUser.id_hash)))
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
                            Mostrando {users.from ?? 0} a {users.to ?? 0} de {users.total}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {users.links.map((link, index) => (
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
