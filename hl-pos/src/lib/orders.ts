import { formatVnd } from './money';

export const STATUSES = ['design_confirmed', 'production', 'installation', 'completed'] as const;
export type OrderStatus = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<OrderStatus, string> = {
  design_confirmed: 'Chốt thiết kế', production: 'Sản xuất', installation: 'Lắp đặt', completed: 'Hoàn thành',
};

export const STATUS_COLOR: Record<OrderStatus, string> = {
  design_confirmed: 'bg-amber-50 text-amber-800', production: 'bg-blue-50 text-blue-800',
  installation: 'bg-purple-50 text-purple-800', completed: 'bg-green-50 text-ok',
};

export function orderRemaining(total: number, payments: { amount: number; paid: boolean }[]): number {
  return total - payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
}

/** Chia mặc định 30% cọc / 40% đợt 2 / phần còn lại nghiệm thu (làm tròn nghìn đồng). Sửa được trên giao diện. */
export function defaultPayments(total: number): { label: string; amount: number }[] {
  const coc = Math.round((total * 0.3) / 1000) * 1000;
  const dot2 = Math.round((total * 0.4) / 1000) * 1000;
  return [
    { label: 'Cọc', amount: coc },
    { label: 'Đợt 2', amount: dot2 },
    { label: 'Nghiệm thu', amount: total - coc - dot2 },
  ];
}

export function scheduleWarning(total: number, payments: { amount: number }[]): string {
  const diff = total - payments.reduce((s, p) => s + p.amount, 0);
  if (diff > 0) return `Các đợt còn thiếu ${formatVnd(diff)} so với giá trị đơn.`;
  if (diff < 0) return `Các đợt thừa ${formatVnd(-diff)} so với giá trị đơn.`;
  return '';
}
