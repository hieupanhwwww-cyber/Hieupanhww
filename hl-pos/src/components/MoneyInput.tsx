'use client';
import { parseVnd } from '@/lib/money';

const fmt = (n: number) => (n ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '');

/** Ô nhập tiền: tự thêm dấu chấm ngăn cách, giá trị là số nguyên đồng. */
export function MoneyInput({ value, onChange, id, placeholder = '0', className = '' }: {
  value: number; onChange: (n: number) => void; id?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <input id={id} inputMode="numeric" className="input pr-8 text-right" placeholder={placeholder} value={fmt(value)}
        onChange={(e) => { const n = parseVnd(e.target.value); if (!Number.isNaN(n) && n >= 0) onChange(n); }} />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted">đ</span>
    </div>
  );
}
