'use client';
import { useOnline } from '@/lib/useOnline';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="alert" className="no-print sticky top-0 z-40 bg-danger px-4 py-2 text-center text-sm font-medium text-white">
      Mất mạng – chưa thể lưu hóa đơn hay phiếu. Dữ liệu chưa bị ghi dở, có mạng lại thì làm tiếp.
    </div>
  );
}
