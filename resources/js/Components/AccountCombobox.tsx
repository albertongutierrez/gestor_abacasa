import { useEffect, useId, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';

type AccountOption = { id: string; name: string; document?: string | null };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();

export default function AccountCombobox({ accounts, value, onChange }: {
    accounts: AccountOption[];
    value: string | null;
    onChange: (id: string) => void;
}) {
    const id = useId();
    const input = useRef<HTMLInputElement>(null);
    const list = useRef<HTMLUListElement>(null);
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [active, setActive] = useState(-1);
    const selected = accounts.find(account => account.id === value);
    const matches = accounts.filter(account => normalize(`${account.name} ${account.document ?? ''}`).includes(normalize(search)));
    const close = () => { setOpen(false); setSearch(''); setActive(-1); };
    const choose = (account: AccountOption) => { onChange(account.id); close(); input.current?.blur(); };

    useEffect(() => {
        if (active >= 0) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    return <div className="relative w-full min-w-0" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
    }}>
        <label htmlFor={id} className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">Cuenta</label>
        <div className="relative">
            <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open}
                aria-controls={`${id}-options`} aria-activedescendant={open && active >= 0 && matches[active] ? `${id}-option-${matches[active].id}` : undefined}
                autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="search"
                className="min-h-[48px] w-full rounded-lg border-slate-300 bg-white py-3 pl-10 pr-12 text-base focus:border-emerald-500 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                placeholder="Buscar cuenta" value={open ? search : selected?.name ?? ''}
                onFocus={() => { setOpen(true); setSearch(''); setActive(-1); }}
                onChange={event => { setSearch(event.target.value); setOpen(true); setActive(-1); }}
                onKeyDown={event => {
                    if (event.nativeEvent.isComposing) return;
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault(); setOpen(true);
                        setActive(previous => matches.length ? (event.key === 'ArrowDown' ? Math.min(previous + 1, matches.length - 1) : previous < 0 ? matches.length - 1 : Math.max(previous - 1, 0)) : -1);
                    } else if (event.key === 'Enter' && open) {
                        event.preventDefault(); if (active >= 0 && matches[active]) choose(matches[active]);
                    } else if (event.key === 'Escape') { event.preventDefault(); close(); input.current?.blur(); }
                }} />
            {(selected || search) && <button type="button" aria-label="Limpiar cliente seleccionado"
                className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center rounded-r-lg text-slate-500 hover:text-slate-900 dark:hover:text-white"
                onMouseDown={event => event.preventDefault()} onClick={() => { onChange(''); setSearch(''); setActive(-1); setOpen(true); input.current?.focus(); }}><X size={18} /></button>}
        </div>
        {open && <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-900">
            <ul ref={list} id={`${id}-options`} role="listbox" aria-label="Clientes y proveedores"
                className="max-h-[min(280px,35dvh)] overflow-y-auto overscroll-contain py-1">
                {matches.map((account, index) => <li key={account.id} id={`${id}-option-${account.id}`} role="option" aria-selected={value === account.id}
                    className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 px-4 py-3 ${active === index ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100' : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800'}`}
                    onMouseDown={event => event.preventDefault()} onClick={() => choose(account)}>
                    <span className="min-w-0"><span className="block break-words text-base font-medium">{account.name}</span>{account.document && <span className="mt-0.5 block break-words text-xs text-slate-500 dark:text-slate-400">{account.document}</span>}</span>
                    {value === account.id && <Check size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />}
                </li>)}
            </ul>
            {!matches.length && <p role="status" className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">{accounts.length ? 'No se encontraron clientes con esa búsqueda.' : 'Todavía no hay clientes o proveedores registrados.'}</p>}
        </div>}
    </div>;
}
