'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { loadProducts, matches, KIND_LABEL, type Product } from '@/lib/products';
import { formatVnd, formatQty } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';

type Filter = 'all' | 'goods' | 'material' | 'low' | 'inactive';

export default function ProductsPage() {
  const { role } = useProfile();
  const isOwner = role === 'owner';
  const [items, setItems] = useState<Product[]>([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [moving, setMoving] = useState<Product | null>(null);
  const [history, setHistory] = useState<Product | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    loadProducts(isOwner).then(setItems, (e) => setError(errorText(e)));
  }, [isOwner, version]);

  const shown = useMemo(() => items.filter((p) => {
    if (!matches(p, query)) return false;
    if (filter === 'inactive') return !p.active;
    if (!p.active) return false;
    if (filter === 'low') return p.is_low;
    if (filter === 'goods' || filter === 'material') return p.kind === filter;
    return true;
  }), [items, query, filter]);

  const lowCount = items.filter((p) => p.active && p.is_low).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Hàng hóa</h1>
        {isOwner && <button className="btn-primary" onClick={() => setEditing('new')}>+ Thêm hàng</button>}
      </div>
      <input className="input" placeholder="Tìm theo tên hoặc mã…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {([['all', 'Tất cả'], ['goods', 'Hàng có sẵn'], ['material', 'Vật tư'], ['low', `Sắp hết (${lowCount})`], ['inactive', 'Ngừng bán']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`chip border px-3 py-1 text-sm ${filter === k ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p className="text-danger">{error}</p>}

      <ul className="space-y-2">
        {shown.map((p) => (
          <li key={p.id} className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{p.name}</div>
              <div className="text-sm text-muted">
                {p.code} · {KIND_LABEL[p.kind]} · {formatVnd(p.sale_price)}/{p.unit}
                {isOwner && <> · vốn {p.cost_price == null ? 'chưa nhập' : formatVnd(p.cost_price)}</>}
              </div>
            </div>
            <div className="text-right">
              <div className={`font-semibold ${p.is_low ? 'text-danger' : ''}`}>{formatQty(p.stock)} {p.unit}</div>
              {p.is_low && <span className="chip bg-red-50 text-danger">Sắp hết</span>}
            </div>
            <div className="flex w-full gap-2 md:w-auto">
              <button className="btn-ghost flex-1 py-1.5 text-sm" onClick={() => setMoving(p)}>Nhập/Xuất</button>
              <button className="btn-ghost flex-1 py-1.5 text-sm" onClick={() => setHistory(p)}>Lịch sử</button>
              {isOwner && <button className="btn-ghost flex-1 py-1.5 text-sm" onClick={() => setEditing(p)}>Sửa</button>}
            </div>
          </li>
        ))}
        {!shown.length && !error && <li className="text-muted">Không có hàng nào.</li>}
      </ul>

      {editing && <ProductForm product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {moving && <StockForm product={moving} onClose={() => setMoving(null)} onSaved={() => { setMoving(null); reload(); }} />}
      {history && <History product={history} onClose={() => setHistory(null)} />}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    code: product?.code ?? '', name: product?.name ?? '', kind: product?.kind ?? 'goods', unit: product?.unit ?? 'cái',
    sale_price: product?.sale_price ?? 0, cost_price: product?.cost_price ?? 0, low: product?.low_stock_threshold ?? 0,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const sb = supabase();
    const { error } = await sb.rpc('save_product', {
      p_id: product?.id ?? null, p_code: f.code, p_name: f.name, p_kind: f.kind, p_unit: f.unit,
      p_sale_price: f.sale_price, p_low_stock_threshold: f.low, p_cost_price: f.cost_price,
    });
    setBusy(false);
    if (error) setError(errorText(error)); else onSaved();
  }

  async function toggleActive() {
    if (!product) return;
    const { error } = await supabase().rpc('set_product_active', { p_id: product.id, p_active: !product.active });
    if (error) setError(errorText(error)); else onSaved();
  }

  return (
    <Modal title={product ? 'Sửa hàng hóa' : 'Thêm hàng hóa'} onClose={onClose}>
      <form onSubmit={save} className="grid grid-cols-2 gap-3">
        <div><label className="label">Mã</label><input className="input" required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
        <div><label className="label">Đơn vị</label><input className="input" required value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Tên hàng</label><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="col-span-2"><label className="label">Loại</label>
          <select className="input" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Product['kind'] })}>
            <option value="goods">Hàng có sẵn</option><option value="material">Vật tư</option>
          </select>
        </div>
        <div><label className="label">Giá bán</label><MoneyInput value={f.sale_price} onChange={(n) => setF({ ...f, sale_price: n })} /></div>
        <div><label className="label">Giá vốn</label><MoneyInput value={f.cost_price} onChange={(n) => setF({ ...f, cost_price: n })} /></div>
        <div className="col-span-2"><label className="label">Báo sắp hết khi tồn ≤</label>
          <input className="input" type="number" min={0} step="any" value={f.low} onChange={(e) => setF({ ...f, low: Number(e.target.value) })} />
        </div>
        {error && <p className="col-span-2 text-sm text-danger">{error}</p>}
        <button className="btn-primary col-span-2" disabled={busy}>Lưu</button>
        {product && (
          <button type="button" className="btn-ghost col-span-2" onClick={toggleActive}>
            {product.active ? 'Ngừng bán món này' : 'Bán lại món này'}
          </button>
        )}
      </form>
    </Modal>
  );
}

function StockForm({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<'in' | 'out'>('in');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(qty.replace(',', '.'));
    if (!(q > 0)) { setError('Số lượng phải lớn hơn 0.'); return; }
    setBusy(true);
    const { error } = await supabase().rpc('record_stock', { p_product_id: product.id, p_type: type, p_quantity: q, p_reason: reason.trim() });
    setBusy(false);
    if (error) setError(errorText(error)); else onSaved();
  }

  return (
    <Modal title={`${product.name} · tồn ${formatQty(product.stock)} ${product.unit}`} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['in', 'out'] as const).map((t) => (
            <button type="button" key={t} onClick={() => setType(t)}
              className={type === t ? 'btn-primary' : 'btn-ghost'}>{t === 'in' ? 'Nhập kho' : 'Xuất kho'}</button>
          ))}
        </div>
        <div><label className="label">Số lượng ({product.unit})</label>
          <input className="input" inputMode="decimal" required value={qty} onChange={(e) => setQty(e.target.value)} /></div>
        <div><label className="label">Lý do</label>
          <input className="input" required placeholder={type === 'in' ? 'VD: Nhập từ xưởng' : 'VD: Hàng lỗi'} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>Lưu phiếu</button>
      </form>
    </Modal>
  );
}

type Move = { id: string; type: 'in' | 'out'; quantity: number; reason: string; created_by: string | null; created_at: string; sale_id: string | null; order_id: string | null };

function History({ product, onClose }: { product: Product; onClose: () => void }) {
  const [rows, setRows] = useState<Move[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      sb.from('stock_movements').select('id, type, quantity, reason, created_by, created_at, sale_id, order_id')
        .eq('product_id', product.id).order('created_at', { ascending: false }).limit(100),
      sb.from('profiles').select('id, full_name'),
    ]).then(([m, p]) => {
      setRows((m.data as Move[]) ?? []);
      setNames(Object.fromEntries((p.data ?? []).map((x) => [x.id, x.full_name])));
    });
  }, [product.id]);

  return (
    <Modal title={`Lịch sử kho · ${product.name}`} onClose={onClose}>
      {!rows ? <p className="text-muted">Đang tải…</p> : !rows.length ? <p className="text-muted">Chưa có phiếu nào.</p> : (
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex justify-between gap-3 py-2 text-sm">
              <div>
                <div>{r.reason || (r.sale_id ? 'Bán hàng' : r.order_id ? 'Đơn nội thất' : '')}</div>
                <div className="text-muted">{new Date(r.created_at).toLocaleString('vi-VN')} · {names[r.created_by ?? ''] || '—'}</div>
              </div>
              <div className={`font-semibold ${r.type === 'in' ? 'text-ok' : 'text-danger'}`}>
                {r.type === 'in' ? '+' : '−'}{formatQty(r.quantity)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
