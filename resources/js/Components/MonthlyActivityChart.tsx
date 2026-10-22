import { useState } from 'react';
import { ChartColumn } from 'lucide-react';

type Currency = 'USD' | 'DOP';
type Metric = 'credits' | 'debits' | 'purchases';
export type MonthlyPoint = {month:string} & Record<Currency,Record<Metric,number>>;
const money = (value:number,currency:Currency) => `${currency === 'USD' ? 'USD$' : 'RD$'} ${new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(value/100)}`;
const months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
export default function MonthlyActivityChart({points}:{points:MonthlyPoint[]}) {
    const [metric,setMetric] = useState<Metric>('credits');
    const [currency,setCurrency] = useState<Currency>('USD');
    const maximum = Math.max(1,...points.map(p=>p[currency][metric]));
    const total = points.reduce((sum,p)=>sum+p[currency][metric],0);
    const select = 'min-h-[44px] rounded-lg border-slate-300 bg-white text-sm dark:border-slate-600 dark:bg-slate-950';
    return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5 dark:border-slate-800"><div><h2 className="flex items-center gap-2 font-semibold"><ChartColumn size={19}/>Evolución mensual</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Últimos 12 meses · Mes actual hasta hoy</p></div><div className="flex flex-wrap gap-2"><select aria-label="Tipo de movimiento del gráfico" className={select} value={metric} onChange={e=>setMetric(e.target.value as Metric)}><option value="credits">Créditos</option><option value="debits">Débitos / abonos</option><option value="purchases">Compras V2</option></select><select aria-label="Moneda del gráfico" className={select} value={currency} onChange={e=>setCurrency(e.target.value as Currency)}><option value="USD">USD$</option><option value="DOP">RD$</option></select></div></header>
        <div className="p-4 sm:p-5"><div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:grid-cols-6 xl:grid-cols-12" role="list" aria-label="Totales mensuales">{points.map((p,i)=>{const value=p[currency][metric];const label=months[Number(p.month.slice(5))-1]+' '+p.month.slice(0,4);return <div key={p.month} role="listitem" aria-label={`${label}: ${money(value,currency)}`}><div title={`${label}: ${money(value,currency)}`} className="flex h-28 items-end rounded-lg bg-slate-100 p-1 dark:bg-slate-950 sm:h-36 xl:h-48"><div className={'w-full rounded-md '+(i===points.length-1?'bg-emerald-600 dark:bg-emerald-300':'bg-emerald-500 dark:bg-emerald-400')} style={{height:value>0?`${Math.max(2,value/maximum*100)}%`:'0%'}}/></div><p className="mt-2 text-center text-xs font-semibold capitalize">{label}</p><p className="mt-1 break-words text-center text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{money(value,currency)}</p></div>;})}</div>
        <div className="mt-5 flex flex-wrap justify-between gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm dark:bg-slate-950"><span>Total del período</span><strong className="tabular-nums">{money(total,currency)}</strong></div><p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{total===0?'Sin movimientos para esta selección. ':''}{metric==='credits'?'Los créditos incluyen las compras V2. ':''}Cada barra representa un mes; los movimientos cancelados no se incluyen.</p></div>
    </section>;
}
