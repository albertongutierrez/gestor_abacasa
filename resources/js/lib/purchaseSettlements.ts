import type { Row } from '@/Pages/Ledger/Index';

export type SettlementGroup = { month: string; product: string; purchases_minor: number; applied_minor: number; pending_minor: number; quantity: number; rows: Row[] };
export type SettlementSummary = { available_minor: number; general_pending_minor: number; pending_minor: number; groups: SettlementGroup[] };
export const monthLabel = (month: string) => {
    const [year, number] = month.split('-').map(Number);
    if (!year || !number) return month;
    return new Intl.DateTimeFormat('es-DO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, number - 1, 1)));
};
export const usd = (minor: number) => `USD$ ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100)}`;
export function settlementLabel(row: Row) {
    const month = row.details?.settlement_month ?? (row.kind === 'purchase' ? row.date.slice(0, 7) : '');
    const product = row.kind === 'purchase' ? row.details?.items?.[0]?.product : row.details?.product;
    return month && product ? `${product} · ${monthLabel(month)}` : '';
}
