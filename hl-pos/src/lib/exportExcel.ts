import ExcelJS from 'exceljs';

export const SHEET_NAMES: Record<string, string> = {
  hang_hoa: 'Hàng hóa', phieu_kho: 'Phiếu kho', hoa_don: 'Hóa đơn', dong_hoa_don: 'Dòng hóa đơn',
  don_noi_that: 'Đơn nội thất', nguoi_dung: 'Người dùng', khach_hang: 'Khách hàng', bao_gia_dong: 'Báo giá (dòng)',
  phieu_thu: 'Phiếu thu', phat_sinh: 'Phát sinh', so_thu_chi: 'Sổ thu chi', danh_muc: 'Danh mục',
};

type Data = Record<string, Record<string, unknown>[]>;

/** Tạo file .xlsx (mỗi bảng một sheet) từ kết quả export_all(). */
export async function buildWorkbook(data: Data): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  for (const [key, rows] of Object.entries(data)) {
    const ws = wb.addWorksheet(SHEET_NAMES[key] ?? key);
    if (!rows.length) { ws.addRow(['(trống)']); continue; }
    const cols = Object.keys(rows[0]);
    ws.addRow(cols).font = { bold: true };
    for (const r of rows) ws.addRow(cols.map((c) => r[c] ?? null));
    ws.columns.forEach((col) => { col.width = 18; });
  }
  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export function backupFileName(now = new Date()): string {
  return `HL-POS-sao-luu-${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })}.xlsx`;
}
