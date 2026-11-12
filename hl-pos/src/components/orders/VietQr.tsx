'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { vietQrPayload, orderMemo, bankReady, bankName, cleanAccount } from '@/lib/vietqr';
import { formatVnd } from '@/lib/money';
import type { Settings } from '@/lib/settings';

/** Mã VietQR cho một khoản thu của đơn. Chưa nhập ngân hàng thì không hiện gì (trả về null). */
export function VietQr({ settings, code, n, amount, size = 160, compact = false }: { settings: Settings; code: string; n: number; amount: number; size?: number; compact?: boolean }) {
  const ready = bankReady(settings) && amount > 0;
  const memo = orderMemo(settings.memo_prefix, code, n);
  const payload = ready ? vietQrPayload({ bin: settings.bank_bin, account: cleanAccount(settings.bank_account), amount, memo }) : '';
  const [src, setSrc] = useState('');
  useEffect(() => {
    if (!payload) return;
    let alive = true;
    QRCode.toDataURL(payload, { errorCorrectionLevel: 'M', margin: 1, width: size * 3 }).then((u) => { if (alive) setSrc(u); });
    return () => { alive = false; };
  }, [payload, size]);
  if (!ready) return null;
  return (
    <div className={`flex items-center gap-3 ${compact ? '' : 'rounded-xl border border-line p-3'}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt={`Mã VietQR ${formatVnd(amount)}`} width={size} height={size} data-qr={payload} /> : <div style={{ width: size, height: size }} />}
      <div className="text-sm leading-relaxed">
        <div className="font-semibold">{settings.bank_name || bankName(settings.bank_bin)}</div>
        <div>STK: <b>{cleanAccount(settings.bank_account)}</b></div>
        {settings.bank_holder && <div>Chủ TK: {settings.bank_holder}</div>}
        <div>Số tiền: <b>{formatVnd(amount)}</b></div>
        <div>Nội dung: <b>{memo}</b></div>
      </div>
    </div>
  );
}
