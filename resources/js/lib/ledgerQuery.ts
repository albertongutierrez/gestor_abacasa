import axios from 'axios';
import { useForm, usePage } from '@inertiajs/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageProps } from '@/types';
import { notify } from '@/lib/notify';

export function ledgerHeaders(branch: string) {
    return { Accept: 'application/json', 'X-Ledger-Branch': branch };
}

export function ledgerError(error: unknown): string {
    if (!axios.isAxiosError(error)) return 'No se pudo completar la solicitud. Intenta nuevamente.';
    if (!error.response) return 'No hay conexión. Comprueba tu conexión antes de volver a intentar.';
    const status = error.response.status;
    if (status === 401 || status === 419) return 'Tu sesión venció. Recarga la página e inicia sesión nuevamente.';
    if (status === 403) return 'No tienes permiso para esta operación. Recarga para actualizar tus accesos.';
    if (status === 409) return 'La sucursal activa cambió. Recarga la página antes de continuar.';
    return error.response.data?.message || 'No se pudo completar la solicitud.';
}

// Inertia manages form values; TanStack Query owns submission and server cache.
export function useLedgerForm<T extends Record<string, any>>(initial: T) {
    const form = useForm<T>(initial);
    const { auth } = usePage<PageProps>().props;
    const branch = auth.activeBranchOffice?.id_hash ?? '';
    const queryClient = useQueryClient();
    const mutation = useMutation({
        mutationFn: async ({ url, method, data }: { url: string; method: 'post' | 'put'; data: T }) => {
            const response = await axios.request<{ message: string }>({ url, method, data, headers: ledgerHeaders(branch) });
            if (!String(response.headers['content-type'] ?? '').includes('application/json')) throw new Error('Respuesta de sesión inválida');
            return response.data;
        },
        onSuccess: async (response) => {
            await queryClient.invalidateQueries({ queryKey: ['ledger', auth.user.id, branch] });
            notify(response.message, 'success');
        },
        onError: (error) => {
            if (axios.isAxiosError(error) && error.response?.status === 422) {
                const errors = error.response.data.errors ?? {};
                form.setError(Object.fromEntries(Object.entries(errors).map(([key, values]) => [key, Array.isArray(values) ? values[0] : String(values)])) as Record<keyof T, string>);
            } else form.setError('request' as keyof T, ledgerError(error));
        },
    });
    const send = (method: 'post' | 'put', url: string, options: { onSuccess?: () => void; preserveScroll?: boolean } = {}) => {
        if (mutation.isPending) return;
        form.clearErrors();
        mutation.mutate({ method, url, data: form.data }, { onSuccess: options.onSuccess });
    };
    return { ...form, processing: mutation.isPending,
        post: (url: string, options?: { onSuccess?: () => void; preserveScroll?: boolean }) => send('post', url, options),
        put: (url: string, options?: { onSuccess?: () => void; preserveScroll?: boolean }) => send('put', url, options) };
}
