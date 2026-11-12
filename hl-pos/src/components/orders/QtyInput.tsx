'use client';
import { useState } from 'react';
import { parseQty, fmtQty } from '@/lib/orderMoney';

/** Ô nhập số lượng/kích thước: gõ tự do ("2,88"), rời ô thì chuẩn hóa. */
export function QtyInput({ value, onChange, className = '', label, disabled }: { value: number; onChange: (n: number) => void; className?: string; label: string; disabled?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input className={`input px-2 py-1.5 text-right ${className}`} inputMode="decimal" aria-label={label} disabled={disabled}
      value={text ?? (value ? fmtQty(value) : '')} placeholder="0"
      onFocus={(e) => { setText(value ? String(value).replace('.', ',') : ''); e.target.select(); }}
      onChange={(e) => { setText(e.target.value); onChange(parseQty(e.target.value)); }}
      onBlur={() => setText(null)} />
  );
}
