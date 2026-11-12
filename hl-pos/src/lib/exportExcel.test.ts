import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildWorkbook, backupFileName, SHEET_NAMES } from './exportExcel';

describe('xuất Excel sao lưu', () => {
  it('mỗi bảng một sheet tên tiếng Việt, có tiêu đề cột và dữ liệu', async () => {
    const buf = await buildWorkbook({
      hang_hoa: [{ ma: 'A', ten: 'Tủ áo', gia_ban: 5000000, gia_von: 3000000 }],
      hoa_don: [],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual([SHEET_NAMES.hang_hoa, SHEET_NAMES.hoa_don]);
    const ws = wb.getWorksheet(SHEET_NAMES.hang_hoa)!;
    expect(ws.getRow(1).values).toEqual([undefined, 'ma', 'ten', 'gia_ban', 'gia_von']);
    expect(ws.getRow(2).getCell(4).value).toBe(3000000);
    expect(wb.getWorksheet(SHEET_NAMES.hoa_don)!.getRow(1).getCell(1).value).toBe('(trống)');
  });

  it('tên file có ngày giờ Việt Nam', () => {
    expect(backupFileName(new Date('2026-11-12T18:00:00Z'))).toBe('HL-POS-sao-luu-2026-11-13.xlsx');
  });
});
