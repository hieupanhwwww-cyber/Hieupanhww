/* VietQR theo chuẩn NAPAS/EMVCo – tạo ngay trên máy, không gọi dịch vụ ngoài. Chép từ parts/qr.js của Sổ Nội Thất. */
import { normalize } from './products';

export const BANKS: [string, string][] = [
  ['970436', 'Vietcombank'], ['970415', 'VietinBank'], ['970418', 'BIDV'], ['970405', 'Agribank'],
  ['970407', 'Techcombank'], ['970422', 'MB Bank'], ['970416', 'ACB'], ['970432', 'VPBank'],
  ['970423', 'TPBank'], ['970403', 'Sacombank'], ['970437', 'HDBank'], ['970441', 'VIB'],
  ['970443', 'SHB'], ['970431', 'Eximbank'], ['970426', 'MSB'], ['970448', 'OCB'],
  ['970440', 'SeABank'], ['970449', 'LPBank'], ['970428', 'Nam A Bank'], ['970409', 'Bac A Bank'],
  ['970425', 'ABBANK'], ['970427', 'VietABank'], ['970412', 'PVcomBank'], ['970452', 'KienlongBank'],
  ['970454', 'BVBank (Bản Việt)'], ['970419', 'NCB'], ['970400', 'Saigonbank'], ['970438', 'BaoViet Bank'],
  ['970433', 'VietBank'], ['970430', 'PGBank'], ['970429', 'SCB'], ['970408', 'GPBank'],
  ['970414', 'MBV (OceanBank cũ)'], ['970406', 'Vikki Bank (DongA Bank cũ)'], ['970444', 'CBBank'], ['970446', 'Co-opBank'],
  ['970424', 'Shinhan Bank'], ['970457', 'Woori Bank'], ['970458', 'UOB'], ['970410', 'Standard Chartered'],
  ['970439', 'Public Bank'], ['970442', 'Hong Leong Bank'], ['970434', 'Indovina Bank'], ['970459', 'CIMB'],
];
export const bankName = (bin: string) => (BANKS.find((b) => b[0] === bin) || [])[1] || '';

const tlv = (id: string, v: string) => id + String(v.length).padStart(2, '0') + v;
function crc16(s: string): string {
  let crc = 0xffff;
  for (let i = 0; i < s.length; i++) {
    crc ^= s.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
/** Nội dung chuyển khoản: bỏ dấu, viết hoa, chỉ chữ số và khoảng trắng, tối đa 25 ký tự. */
export const qrMemo = (s: string) => normalize(s).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 25);
export function vietQrPayload({ bin, account, amount, memo }: { bin: string; account: string; amount: number; memo: string }): string {
  const acct = tlv('00', bin) + tlv('01', account);
  const mai = tlv('00', 'A000000727') + tlv('01', acct) + tlv('02', 'QRIBFTTA');
  let s = tlv('00', '01') + tlv('01', amount ? '12' : '11') + tlv('38', mai) + tlv('53', '704');
  if (amount) s += tlv('54', String(Math.round(amount)));
  s += tlv('58', 'VN');
  if (memo) s += tlv('62', tlv('08', memo));
  s += '6304';
  return s + crc16(s);
}
export const orderMemo = (prefix: string, code: string, n: number) => qrMemo(`${prefix || ''} ${String(code).replace(/[^A-Za-z0-9]/g, '')}${n ? ' D' + n : ''}`);
export type BankSettings = { bank_bin?: string | null; bank_account?: string | null };
export const cleanAccount = (s: string | null | undefined) => String(s || '').replace(/\s/g, '');
export const bankReady = (st: BankSettings) => /^\d{6}$/.test(st.bank_bin || '') && /^[A-Za-z0-9]{4,19}$/.test(cleanAccount(st.bank_account));
