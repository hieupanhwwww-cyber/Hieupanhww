'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase, errorText } from '@/lib/supabase/client';
import { useProfile } from '@/lib/useProfile';
import { matches } from '@/lib/products';
import { UNITS, type Unit } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { Modal } from '@/components/Modal';
import { MoneyInput } from '@/components/MoneyInput';
import { BooksTabs } from '@/components/BooksTabs';

type Item = { id: string; name: string; material: string; unit: Unit; price: number; cost: number | null };

export default function CatalogPage() {
  const { role } = useProfile();
  const isOwner = role === 'owner';
  const [items, setItems] = useState<Item[] | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Item | 'new' | null>(null);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const sb = supabase();
    Promise.all([sb.from('catalog').select('id, name, material, unit, price').order('name'), isOwner ? sb.from('catalog_costs').select('catalog_id, cost') : Promise.resolve({ data: [], error: null })])
      .then(([c, k]) => {
        if (c.error || k.error) { setError(errorText(c.error ?? k.error)); return; }
        const cost = new Map((k.data ?? []).map((x: { catalog_id: string; cost: number }) => [x.catalog_id, Number(x.cost)]));
        setItems((c.data ?? []).map((x) => ({ ...x, price: Number(x.price), cost: cost.get(x.id) ?? null })) as Item[]);
      });
  }, [isOwner, version]);
  const shown = useMemo(() => (items ?? []).filter((i) => matches({ code: i.material, name: i.name }, query)), [items, query]);

  return (
    <div className="space-y-4">
      {isOwner && <BooksTabs />}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold">Danh mục hạng mục</h1>
        {isOwner && <button className="btn-primary" onClick={() => setEditing('new')}>+ Thêm</button>}
      </div>
      <p className="text-sm text-muted">Khi soạn báo giá, gõ tên hạng mục sẽ hiện gợi ý từ danh mục này (tự điền vật liệu, đơn vị, đơn giá).</p>
      <input className="input" placeholder="Tìm hạng mục…" value={query} onChange={(e) => setQuery(e.target.value)} />
      {error && <p className="text-danger">{error}</p>}
      <ul className="space-y-2">
        {shown.map((i) => (
          <li key={i.id} className="card flex items-center gap-3 p-3" data-catalog={i.name}>
            <div className="min-w-0 flex-1">
              <div className="font-medium">{i.name}</div>
              <div className="text-sm text-muted">{[i.material, `${formatVnd(i.price)}/${i.unit}`, isOwner ? `nhập ${i.cost == null ? 'chưa có' : formatVnd(i.cost)}` : ''].filter(Boolean).join(' · ')}</div>
            </div>
            {isOwner && <button className="btn-ghost px-3 py-1 text-sm" onClick={() => setEditing(i)}>Sửa</button>}
          </li>
        ))}
        {items && !shown.length && <li className="text-muted">{items.length ? 'Không thấy hạng mục phù hợp.' : 'Danh mục trống.'}</li>}
      </ul>
      {editing && <ItemForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setVersion((v) => v + 1); }} />}
    </div>
  );
}

function ItemForm({ item, onClose, onSaved }: { item: Item | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: item?.name ?? '', material: item?.material ?? '', unit: item?.unit ?? ('m²' as Unit), price: item?.price ?? 0, cost: item?.cost ?? 0 });
  const [error, setError] = useState('');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase().rpc('save_catalog_item', { p_id: item?.id ?? null, p_name: f.name, p_material: f.material, p_unit: f.unit, p_price: f.price, p_cost: f.cost });
    if (error) setError(/duplicate|unique/i.test(error.message) ? 'Đã có hạng mục trùng tên.' : errorText(error)); else onSaved();
  }
  async function remove() {
    if (!item || !confirm(`Xóa "${item.name}" khỏi danh mục? Báo giá cũ không bị ảnh hưởng.`)) return;
    const { error } = await supabase().rpc('delete_catalog_item', { p_id: item.id });
    if (error) setError(errorText(error)); else onSaved();
  }
  return (
    <Modal title={item ? 'Sửa hạng mục' : 'Thêm hạng mục'} onClose={onClose}>
      <form onSubmit={save} className="space-y-3">
        <div><label className="label" htmlFor="k-name">Tên hạng mục</label><input id="k-name" className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><label className="label" htmlFor="k-mat">Vật liệu, màu</label><input id="k-mat" className="input" value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} /></div>
        <div><label className="label" htmlFor="k-unit">Đơn vị</label>
          <select id="k-unit" className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value as Unit })}>{UNITS.map((u) => <option key={u}>{u}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Giá bán / {f.unit}</label><MoneyInput value={f.price} onChange={(v) => setF({ ...f, price: v })} /></div>
          <div><label className="label">Giá nhập / {f.unit}</label><MoneyInput value={f.cost} onChange={(v) => setF({ ...f, cost: v })} /></div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full">Lưu</button>
        {item && <button type="button" className="btn-danger w-full" onClick={remove}>Xóa khỏi danh mục</button>}
      </form>
    </Modal>
  );
}
