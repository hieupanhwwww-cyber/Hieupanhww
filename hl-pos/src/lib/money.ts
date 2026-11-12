/** 1250000 → "1.250.000 đ" */
export function formatVnd(n: number | string): string {
  const v = Math.round(Number(n));
  const s = Math.abs(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${v < 0 ? '-' : ''}${s} đ`;
}

/** "1.250.000" → 1250000; ô trống → 0; chữ/số lẻ → NaN */
export function parseVnd(s: string): number {
  const t = s.replace(/[.\sđ]/gi, '');
  if (t === '') return 0;
  return /^-?\d+$/.test(t) ? Number(t) : NaN;
}

/** Số lượng: 7.000 → "7", 2.5 → "2,5" */
export function formatQty(n: number | string): string {
  return Number(n).toLocaleString('vi-VN', { maximumFractionDigits: 3 });
}
