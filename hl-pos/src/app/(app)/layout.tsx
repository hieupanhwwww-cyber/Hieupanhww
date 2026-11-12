'use client';
import { ProfileProvider } from '@/lib/useProfile';
import { Nav } from '@/components/Nav';
import { OfflineBanner } from '@/components/OfflineBanner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <OfflineBanner />
      <div className="md:flex">
        <Nav />
        <main className="flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8 max-w-6xl">{children}</main>
      </div>
    </ProfileProvider>
  );
}
