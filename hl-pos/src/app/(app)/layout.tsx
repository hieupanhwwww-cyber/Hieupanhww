'use client';
import { ProfileProvider } from '@/lib/useProfile';
import { Nav } from '@/components/Nav';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <div className="md:flex">
        <Nav />
        <div className="min-w-0 flex-1">
          <OfflineBanner />
          {/* pb-24 trên điện thoại: chừa chỗ cho nút "Powered by Netlify" ở góc dưới phải */}
          <main className="max-w-6xl px-4 pb-24 pt-4 md:px-6 md:pb-8">{children}</main>
        </div>
      </div>
    </ProfileProvider>
  );
}
