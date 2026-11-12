'use client';
import { useRef, useState, type ReactNode } from 'react';
import { toBlob } from 'html-to-image';
import { errorText } from '@/lib/supabase/client';

const SIZE = { A4: { w: '210mm', h: '297mm', margin: '10mm' }, A5: { w: '148mm', h: '210mm', margin: '8mm' } } as const;

/** Khung giấy in (A4/A5) kèm nút In và Gửi ảnh Zalo. Nội dung là children. */
export function PrintSheet({ size = 'A4', fileName, title, actions, children }: { size?: 'A4' | 'A5'; fileName: string; title: string; actions?: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState('');
  const s = SIZE[size];

  async function shareImage() {
    if (!ref.current) return;
    setMsg('Đang tạo ảnh…');
    try {
      const blob = await toBlob(ref.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      if (!blob) throw new Error('Không tạo được ảnh');
      const file = new File([blob], `${fileName}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        setMsg('');
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(file);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setMsg('Đã lưu ảnh. Mở Zalo và gửi ảnh vừa tải cho khách.');
      }
    } catch (e) {
      setMsg((e as Error).name === 'AbortError' ? '' : errorText(e));
    }
  }

  return (
    <div className="space-y-3">
      {/* khổ giấy theo từng trang in (Safari không hỗ trợ đặt tên trang nên chèn trực tiếp) */}
      <style>{`@page { size: ${size}; margin: ${s.margin}; }`}</style>
      <div className="no-print flex flex-wrap items-center gap-2">
        {actions}
        <div className="flex-1" />
        <button className="btn-primary" onClick={() => window.print()}>In</button>
        <button className="btn-ghost" onClick={shareImage}>Gửi ảnh Zalo</button>
      </div>
      {msg && <p className="no-print text-sm text-muted">{msg}</p>}
      <div className="overflow-x-auto rounded-xl border border-line print:overflow-visible print:rounded-none print:border-0">
        <div ref={ref} className="mx-auto bg-white text-black print:!w-auto print:!min-h-0 print:!p-0" style={{ width: s.w, minHeight: `calc(${s.h} - 2 * ${s.margin})`, padding: size === 'A4' ? '10mm' : '6mm' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
