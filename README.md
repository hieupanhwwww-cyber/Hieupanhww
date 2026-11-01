# Sổ Nội Thất — Nội Thất Hùng Loan

Web app chạy trên iPad (cài được lên màn hình chính) để lập báo giá nội thất, xuất PDF/ảnh, chốt đơn, thu tiền theo đợt (có mã VietQR), ghi phát sinh, nghiệm thu, sổ thu chi, cộng sổ theo tháng và làm việc nhiều người qua Firebase.

## Dùng ngay
- Bản cài iPad: nhánh `gh-pages` của repo này (GitHub Pages).
- Bản một tệp: `so-noi-that.html`.

## Cấu trúc mã
| Thư mục / tệp | Nội dung |
|---|---|
| `parts/core.js` | Dữ liệu, cài đặt, kho lưu, lịch thanh toán, **`orderMoney`** (mọi con số tiền của một đơn) |
| `parts/orders.js` | **Mô-đun Đơn hàng**: chốt đơn, tạo bản sửa, thu tiền, đổi trạng thái |
| `parts/ui.js`, `home.js`, `cash.js`, `ledger.js`, `library.js`, `profit.js` | Màn hình: đơn, Hôm nay, doanh thu, thu chi, cộng sổ, danh mục, lãi |
| `parts/pdf.js`, `qr.js` | Báo giá PDF/ảnh, phiếu thu, mã VietQR |
| `parts/team.js` | Nhiều người dùng (Firebase): vai trò, mã mời, gộp khi sửa cùng lúc |
| `parts/events.js` | Bắt sự kiện bấm, phím tắt, khởi động |
| `parts/style.css` | Giao diện "Xưởng gỗ" |
| `firebase/` | Luật bảo mật Firestore và kiểm thử luật |
| `pwa/` | Bản đã dựng để đưa lên GitHub Pages |
| `test/` | Kiểm thử (Playwright + Node) |
| `docs/` | Ghi chú nghiên cứu |

## Dựng lại
```
python3 build.py      # tạo so-noi-that.html, test/local.html, pwa/index.html
```

## Kiểm thử
```
node test/money.test.js        # tính tiền của đơn (không cần trình duyệt)
node test/merge.test.js        # gộp dữ liệu nhiều người
python3 test/run.py            # và run2…run15: chạy app thật bằng Playwright
```
