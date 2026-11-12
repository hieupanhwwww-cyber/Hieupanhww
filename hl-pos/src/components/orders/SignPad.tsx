'use client';
import { useEffect, useRef, useState } from 'react';

/** Ô ký tên bằng ngón tay / bút / chuột. onChange nhận ảnh PNG (≤ 600×240) hoặc null khi xóa. */
export function SignPad({ onChange }: { onChange: (png: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current!;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    c.width = c.clientWidth * ratio; c.height = c.clientHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1a1a1a';
  }, []);

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  function down(e: React.PointerEvent) {
    e.preventDefault(); ref.current!.setPointerCapture(e.pointerId); drawing.current = true;
    const ctx = ref.current!.getContext('2d')!; const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke();
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current) return;
    const ctx = ref.current!.getContext('2d')!; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false; setEmpty(false);
    const c = ref.current!, out = document.createElement('canvas');
    const k = Math.min(1, 600 / c.width, 240 / c.height);
    out.width = Math.round(c.width * k); out.height = Math.round(c.height * k);
    out.getContext('2d')!.drawImage(c, 0, 0, out.width, out.height);
    onChange(out.toDataURL('image/png'));
  }
  function clear() {
    const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setEmpty(true); onChange(null);
  }
  return (
    <div>
      <div className="relative">
        <canvas ref={ref} aria-label="Ô ký tên" className="h-36 w-full touch-none rounded-xl border border-dashed border-brand bg-white"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted">Khách ký vào đây</span>}
      </div>
      {!empty && <button type="button" className="mt-1 text-sm text-brand underline" onClick={clear}>Ký lại</button>}
    </div>
  );
}
