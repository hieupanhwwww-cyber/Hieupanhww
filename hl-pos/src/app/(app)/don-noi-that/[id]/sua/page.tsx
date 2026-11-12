'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase, errorText } from '@/lib/supabase/client';
import { getOrder, saveDraft } from '@/lib/ordersApi';
import { loadSettings, type Settings } from '@/lib/settings';
import { DEFAULT_PLAN, newPlan, newRow, quoteTotals, vnToday, type Quote } from '@/lib/orderMoney';
import { formatVnd } from '@/lib/money';
import { QuoteEditor, type CustomerLite, type CatalogLite } from '@/components/orders/QuoteEditor';

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export default function QuoteEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [catalog, setCatalog] = useState<CatalogLite[]>([]);
  const [code, setCode] = useState('');
  const [orderId, setOrderId] = useState<string | null>(id === 'moi' ? null : id);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  // giá trị mới nhất cho vòng lưu (không phụ thuộc lần vẽ)
  const ref = useRef<{ orderId: string | null; rev: number | null; quote: Quote | null; dirty: boolean; saving: boolean; conflict: boolean; timer: ReturnType<typeof setTimeout> | null }>(
    { orderId: id === 'moi' ? null : id, rev: null, quote: null, dirty: false, saving: false, conflict: false, timer: null });

  useEffect(() => {
    const sb = supabase();
    Promise.all([
      loadSettings(),
      sb.from('customers').select('name, phone, address').order('created_at', { ascending: false }).limit(1000),
      sb.from('catalog').select('name, material, unit, price').limit(2000).then((r) => (r.error ? { data: [] } : r)),
      id === 'moi' ? null : getOrder(id),
    ]).then(([st, cs, cat, full]) => {
      setSettings(st);
      setCustomers((cs.data ?? []) as CustomerLite[]);
      setCatalog(((cat.data ?? []) as CatalogLite[]).map((k) => ({ ...k, price: Number(k.price) })));
      if (full) {
        if (!full.order.draft) { router.replace(`/don-noi-that/${id}`); return; }
        ref.current.rev = full.head.rev;
        setCode(full.head.code);
        setQuote(full.order.draft);
      } else {
        setQuote({ date: vnToday(), customer: { name: '', phone: '', address: '' }, project: '', rows: [newRow()], discount: { type: 'amount', value: 0 },
          note: st.default_note, terms: st.default_terms, validUntil: '', plan: newPlan(st.plan_template?.length ? st.plan_template : DEFAULT_PLAN) });
      }
    }, (e) => setError(errorText(e)));
  }, [id, router]);

  const flush = useCallback(async (): Promise<boolean> => {
    const r = ref.current;
    if (r.timer) { clearTimeout(r.timer); r.timer = null; }
    while (r.saving) await new Promise((res) => setTimeout(res, 150));
    while (r.dirty && r.quote) {
      if (r.conflict) return false;
      if (!r.quote.customer.name.trim()) { setState('dirty'); return false; }
      r.saving = true; r.dirty = false; setState('saving');
      try {
        const res = await saveDraft(r.orderId, r.quote, r.rev);
        if (!r.orderId) { window.history.replaceState(null, '', `/don-noi-that/${res.order_id}/sua`); setCode(res.code); setOrderId(res.order_id); }
        r.orderId = res.order_id; r.rev = res.rev;
        setState(r.dirty ? 'dirty' : 'saved'); setError('');
      } catch (e) {
        r.dirty = true;
        const msg = errorText(e);
        r.conflict = /người khác sửa/.test(msg);
        setError(msg); setState(r.conflict ? 'conflict' : 'error');
        return false;
      } finally {
        r.saving = false;
      }
    }
    return true;
  }, []);

  function change(q: Quote) {
    setQuote(q);
    const r = ref.current;
    r.quote = q; r.dirty = true;
    if (r.conflict) return;
    setState('dirty');
    if (r.timer) clearTimeout(r.timer);
    r.timer = setTimeout(() => { flush(); }, 800);
  }

  async function done() {
    if (await flush() && ref.current.orderId) router.push(`/don-noi-that/${ref.current.orderId}`);
    else if (!ref.current.quote?.customer.name.trim()) setError('Nhập tên khách trước khi lưu.');
  }

  if (!quote) return <p className={error ? 'text-danger' : 'text-muted'}>{error || 'Đang tải…'}</p>;
  const total = quoteTotals(quote).total;
  const label: Record<SaveState, string> = { idle: '', dirty: quote.customer.name.trim() ? 'Chưa lưu…' : 'Nhập tên khách để lưu', saving: 'Đang lưu…', saved: 'Đã lưu', error: 'Chưa lưu được', conflict: 'Có người khác vừa sửa' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={orderId ? `/don-noi-that/${orderId}` : '/don-noi-that'} className="text-sm text-muted">← Quay lại</Link>
        <span className={`text-sm ${state === 'error' || state === 'conflict' ? 'text-danger' : 'text-muted'}`} data-save-state={state}>{label[state]}</span>
      </div>
      <h1 className="text-xl font-bold">{code ? `Báo giá ${code}` : 'Báo giá mới'}</h1>
      {state === 'conflict' && (
        <div className="card border-danger text-sm">
          <p className="text-danger">{error}</p>
          <button className="btn-primary mt-2" onClick={() => window.location.reload()}>Tải lại báo giá mới nhất (bỏ phần đang gõ)</button>
        </div>
      )}
      {state === 'error' && <p className="text-sm text-danger">{error} <button className="underline" onClick={() => flush()}>Thử lưu lại</button></p>}
      <QuoteEditor quote={quote} onChange={change} settings={settings} customers={customers} catalog={catalog} />
      <div className="no-print sticky bottom-0 z-10 -mx-4 flex items-center gap-3 border-t border-line bg-surface px-4 py-3 pr-[220px] md:mx-0 md:rounded-xl md:border md:pr-4">
        <div className="flex-1"><div className="text-xs text-muted">Tổng cộng</div><div className="font-bold text-brand">{formatVnd(total)}</div></div>
        <button className="btn-primary" disabled={state === 'saving' || state === 'conflict'} onClick={done}>Xong</button>
      </div>
    </div>
  );
}
