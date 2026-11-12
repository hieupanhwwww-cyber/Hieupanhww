// Giá trị kỳ vọng lấy bằng cách chạy hàm gốc trong parts/qr.js của Sổ Nội Thất.
import { describe, it, expect } from 'vitest';
import { vietQrPayload, qrMemo, orderMemo, bankReady, bankName } from './vietqr';

describe('VietQR', () => {
  it('có số tiền và nội dung', () =>
    expect(vietQrPayload({ bin: '970436', account: '0123456789', amount: 20_000_000, memo: 'HL BG261101 D1' }))
      .toBe('00020101021238540010A00000072701240006970436011001234567890208QRIBFTTA53037045408200000005802VN62180814HL BG261101 D1630416C7'));
  it('không số tiền, không nội dung (mã tĩnh)', () =>
    expect(vietQrPayload({ bin: '970422', account: '99988877', amount: 0, memo: '' }))
      .toBe('00020101021138520010A000000727012200069704220108999888770208QRIBFTTA53037045802VN6304A127'));
  it('số tiền lẻ được làm tròn; nội dung dài bị cắt 25 ký tự, bỏ dấu, viết hoa', () => {
    const memo = qrMemo('hl Chị Hoa – đợt 2 thanh toán phần còn lại rất dài');
    expect(memo).toBe('HL CHI HOA DOT 2 THANH TO');
    expect(vietQrPayload({ bin: '970407', account: '19031234567890', amount: 1234567.4, memo }))
      .toBe('00020101021238580010A000000727012800069704070114190312345678900208QRIBFTTA5303704540712345675802VN62290825HL CHI HOA DOT 2 THANH TO630436FC');
  });
  it('nội dung chuyển khoản của đơn: <tiền tố> <mã đơn bỏ gạch> D<đợt>', () => {
    expect(orderMemo('HL', 'BG2611-01', 2)).toBe('HL BG261101 D2');
    expect(orderMemo('', 'BG2611-01', 0)).toBe('BG261101');
  });
  it('chỉ tạo mã khi đã nhập ngân hàng hợp lệ', () => {
    expect(bankReady({ bank_bin: '970436', bank_account: '0123 456 789' })).toBe(true);
    expect(bankReady({ bank_bin: '', bank_account: '0123456789' })).toBe(false);
    expect(bankReady({ bank_bin: '970436', bank_account: '12' })).toBe(false);
    expect(bankName('970436')).toBe('Vietcombank');
  });
});
