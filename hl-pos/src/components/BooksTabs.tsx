'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/cong-so', label: 'Cộng sổ' },
  { href: '/so-thu-chi', label: 'Sổ thu chi' },
  { href: '/bao-cao', label: 'Bán lẻ' },
  { href: '/danh-muc', label: 'Danh mục' },
];
/** Thanh chuyển giữa các màn sổ sách (chỉ chủ). */
export function BooksTabs() {
  const path = usePathname();
  return (
    <div className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`chip shrink-0 border px-3 py-1.5 text-sm ${path.startsWith(t.href) ? 'border-brand bg-brand text-white' : 'border-line bg-surface text-muted'}`}>{t.label}</Link>
      ))}
    </div>
  );
}
