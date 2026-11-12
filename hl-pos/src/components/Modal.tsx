'use client';
import type { ReactNode } from 'react';

/** Hộp thoại. Trên điện thoại mở từ dưới lên và dừng phía trên nút "Powered by Netlify" (cao ~64px ở góc dưới) để không nút nào bị che. */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="no-print fixed inset-0 z-30 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div className="mb-[76px] max-h-[calc(100dvh-96px)] w-full overflow-y-auto rounded-2xl bg-surface p-4 md:mb-0 md:max-h-[90vh] md:max-w-lg"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="btn-ghost px-3 py-1" onClick={onClose} aria-label="Đóng">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
