'use client';
import { useState } from 'react';
import { errorText } from '@/lib/supabase/client';
import { addMaterial } from '@/lib/ordersApi';
import { matches, type Product } from '@/lib/products';
import { formatQty } from '@/lib/money';
import { Modal } from '@/components/Modal';

/** Ghi vật tư đã dùng cho đơn (xuất kho). */
export function AddMaterial({ orderId, products, onClose, onSaved }: { orderId: string; products: Product[]; onClose: () => void; onSaved: () => void }) {
  const [query, setQuery] = useState('');
  const [pick, setPick] = useState<Product | null>(null);
  const [qty, setQty] = useState('');
  const [error, setError] = useState('');
  const shown = products
    .filter((p) => matches(p, query))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'material' ? -1 : 1))
    .slice(0, 30);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty.replace(',', '.'));
    if (!pick || !(q > 0)) { setError('Chọn vật tư và nhập số lượng lớn hơn 0.'); return; }
    try { await addMaterial(orderId, pick.id, q); onSaved(); } catch (err) { setError(errorText(err)); }
  }
  return (
    <Modal title="Thêm vật tư đã dùng" onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        {!pick ? (
          <>
            <input className="input" autoFocus placeholder="Tìm vật tư…" value={query} onChange={(e) => setQuery(e.target.value)} />
            <ul className="max-h-72 divide-y divide-line overflow-y-auto">
              {shown.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full justify-between py-2 text-left" onClick={() => setPick(p)}>
                    <span>{p.name} <span className="text-sm text-muted">· {p.code}</span></span>
                    <span className="text-sm text-muted">tồn {formatQty(p.stock)} {p.unit}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl bg-brand-soft px-3 py-2">
              <span>{pick.name} · tồn {formatQty(pick.stock)} {pick.unit}</span>
              <button type="button" className="text-sm text-brand" onClick={() => setPick(null)}>Đổi</button>
            </div>
            <div><label className="label">Số lượng ({pick.unit})</label>
              <input className="input" autoFocus inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            <button className="btn-primary w-full">Ghi xuất kho cho đơn</button>
          </>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>
    </Modal>
  );
}
