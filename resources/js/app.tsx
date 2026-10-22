import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { installContextualNavigation } from './lib/contextualNavigation';

const pages = import.meta.glob('./Pages/**/*.tsx');
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, gcTime: 300000, retry: false }, mutations: { retry: false } } });
const appName = import.meta.env.VITE_APP_NAME || 'Mi Proyecto';
const theme = localStorage.getItem('theme');
document.documentElement.classList.toggle('dark', theme ? theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches);

window.addEventListener('vite:preloadError', () => {
    const key = 'base.asset-reload';
    if (Date.now() - Number(sessionStorage.getItem(key) || 0) < 10000) return;
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
});

createInertiaApp({
    title: title => `${title} - ${appName}`,
    resolve: name => {
        const load = pages[`./Pages/${name}.tsx`];
        if (!load) throw new Error(`Pagina no encontrada: ${name}`);
        return load();
    },
    setup({ el, App, props }) {
        installContextualNavigation(props.initialPage);
        createRoot(el).render(<QueryClientProvider client={queryClient}><App {...props} /></QueryClientProvider>);
    },
    progress: { color: '#059669' },
});
