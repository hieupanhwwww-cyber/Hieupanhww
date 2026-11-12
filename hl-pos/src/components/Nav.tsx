'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProfile } from '@/lib/useProfile';

const ITEMS = [
  { href: '/ban-hang', label: 'Bán hàng', icon: '🛒' },
  { href: '/hang-hoa', label: 'Hàng hóa', icon: '📦' },
  { href: '/don-noi-that', label: 'Đơn nội thất', icon: '🛏️' },
  { href: '/bao-cao', label: 'Báo cáo', icon: '📊', ownerOnly: true },
  { href: '/cai-dat', label: 'Cài đặt', icon: '⚙️' },
];

export function Nav() {
  const path = usePathname();
  const { role } = useProfile();
  const items = ITEMS.filter((i) => !i.ownerOnly || role === 'owner');
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface md:static md:border-t-0 md:border-r md:w-52 md:min-h-screen">
      <div className="hidden md:block px-4 py-5 font-bold text-brand">Nội Thất Hùng Loan</div>
      <ul className="flex md:flex-col">
        {items.map((i) => {
          const active = path.startsWith(i.href);
          return (
            <li key={i.href} className="flex-1">
              <Link
                href={i.href}
                className={`flex flex-col items-center gap-0.5 py-2 text-xs md:flex-row md:gap-3 md:px-4 md:py-3 md:text-sm ${
                  active ? 'text-brand font-semibold md:bg-brand-soft' : 'text-muted'
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
