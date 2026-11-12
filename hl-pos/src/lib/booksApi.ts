'use client';
import { supabase } from './supabase/client';
import { toLedgerData, toBooksOrders, catKey, type LedgerData, type BooksOrder, type CatalogCosts } from './books';

const rpc = async <T,>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw error;
  return data as T;
};
export const loadLedger = async (): Promise<LedgerData> => toLedgerData(await rpc('ledger_data'));
export const loadBooksOrders = async (): Promise<BooksOrder[]> => toBooksOrders(await rpc('orders_for_books'));
export async function loadCatalogCosts(): Promise<CatalogCosts> {
  const sb = supabase();
  const [c, k] = await Promise.all([sb.from('catalog').select('id, name'), sb.from('catalog_costs').select('catalog_id, cost')]);
  if (c.error || k.error) throw c.error ?? k.error;
  const byId = new Map((c.data ?? []).map((x) => [x.id, x.name as string]));
  return new Map((k.data ?? []).filter((x) => byId.has(x.catalog_id)).map((x) => [catKey(byId.get(x.catalog_id)!), Number(x.cost)]));
}
export const saveCashEntry = (a: { id: string | null; type: 'in' | 'out'; date: string; amount: number; cat: string; note: string; method: 'cash' | 'transfer'; order_id: string | null; confirm: boolean }) =>
  rpc<string>('save_cash_entry', { p_id: a.id, p_type: a.type, p_date: a.date, p_amount: a.amount, p_cat: a.cat, p_note: a.note, p_method: a.method, p_order_id: a.order_id, p_confirm: a.confirm });
export const deleteCashEntry = (id: string, confirm: boolean) => rpc<void>('delete_cash_entry', { p_id: id, p_confirm: confirm });
export const closeBook = (month: string, inT: number, outT: number) => rpc<void>('close_book', { p_month: month, p_in: inT, p_out: outT });
export const reopenBook = (month: string) => rpc<void>('reopen_book', { p_month: month });
export const saveOrderCosts = (orderId: string, rows: Record<string, number | null>, chg: Record<string, number | null>, ship: number | null) =>
  rpc<void>('save_order_costs', { p_order_id: orderId, p_rows: rows, p_chg: chg, p_ship: ship });
