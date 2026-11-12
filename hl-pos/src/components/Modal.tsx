'use client';
import type { ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="no-print fixed inset-0 z-30 flex items-end justify-center bg-black/30 md:items-center" onClick={onClose}>
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-4 pb-24 md:max-w-lg md:rounded-2xl md:pb-4"
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
