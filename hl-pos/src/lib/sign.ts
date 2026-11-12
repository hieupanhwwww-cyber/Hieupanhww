import type { SignRecord } from './orderMoney';

/** Mã xác nhận chữ ký: 16 ký tự đầu của SHA-256(nội dung | thời điểm | tên) – giống Sổ Nội Thất. */
export async function makeSignRecord(img: string, name: string, content: unknown, at = new Date().toISOString()): Promise<SignRecord> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content) + '|' + at + '|' + name));
  const hash = [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 16).toUpperCase();
  return { img, name, at, hash };
}
