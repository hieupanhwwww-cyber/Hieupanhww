'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/lib/useProfile';

const ITEMS = [
  { href: '/ban-hang', label: 'Bán hàng', icon: '🛒' },
  { href: '/hang-hoa', label: 'Hàng hóa', icon: '📦' },
  { href: '/don-noi-that', label: 'Đơn nội thất', icon: '🛏️' },
  { href: '/cong-so', label: 'Sổ sách', icon: '📊', ownerOnly: true, also: ['/bao-cao', '/so-thu-chi', '/danh-muc'] },
  { href: '/cai-dat', label: 'Cài đặt', icon: '⚙️' },
];

export function Nav() {
  const path = usePathname();
  const { role } = useProfile();
  const items = ITEMS.filter((i) => !i.ownerOnly || role === 'owner');
  return (
    <nav className="no-print sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top)] md:static md:border-b-0 md:border-r md:pt-0 md:w-52 md:min-h-screen">
      <div className="hidden md:block px-4 py-5 font-bold text-brand">Nội Thất Hùng Loan</div>
      <ul className="flex md:flex-col">
        {items.map((i) => {
          const active = path.startsWith(i.href) || ('also' in i && (i.also as string[]).some((x) => path.startsWith(x)));
          return (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                className={`flex flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] leading-tight md:flex-row md:gap-3 md:border-b-0 md:px-4 md:py-3 md:text-sm ${
                  active ? 'border-brand text-brand font-semibold md:bg-brand-soft' : 'border-transparent text-muted'
                }`}
              >
                <span className="text-lg md:text-base" aria-hidden>{i.icon}</span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
