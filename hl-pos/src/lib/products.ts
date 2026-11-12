'use client';
import { supabase } from './supabase/client';

export type Product = {
  id: string; code: string; name: string; kind: 'goods' | 'material'; unit: string;
  sale_price: number; low_stock_threshold: number; active: boolean;
  stock: number; is_low: boolean; cost_price?: number | null;
};

export const KIND_LABEL = { goods: 'Hàng có sẵn', material: 'Vật tư' } as const;

/** Danh sách hàng kèm tồn kho; chủ có thêm giá vốn. */
export async function loadProducts(withCost: boolean): Promise<Product[]> {
  const sb = supabase();
  const [p, s, c] = await Promise.all([
    sb.from('products').select('id, code, name, kind, unit, sale_price, low_stock_threshold, active').order('name'),
    sb.from('product_stock').select('product_id, stock, is_low'),
    withCost ? sb.from('product_costs').select('product_id, cost_price') : Promise.resolve({ data: [], error: null }),
  ]);
  const err = p.error ?? s.error ?? c.error;
  if (err) throw err;
  const stock = new Map((s.data ?? []).map((r) => [r.product_id, r]));
  const cost = new Map((c.data ?? []).map((r: { product_id: string; cost_price: number }) => [r.product_id, r.cost_price]));
  return (p.data ?? []).map((r) => ({
    ...r,
    sale_price: Number(r.sale_price),
    low_stock_threshold: Number(r.low_stock_threshold),
    stock: Number(stock.get(r.id)?.stock ?? 0),
    is_low: Boolean(stock.get(r.id)?.is_low),
    cost_price: withCost ? (cost.has(r.id) ? Number(cost.get(r.id)) : null) : undefined,
  })) as Product[];
}

/** Bỏ dấu tiếng Việt để tìm kiếm không phân biệt dấu. */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function matches(p: { code: string; name: string }, query: string): boolean {
  const q = normalize(query);
  return !q || normalize(p.name).includes(q) || normalize(p.code).includes(q);
}
