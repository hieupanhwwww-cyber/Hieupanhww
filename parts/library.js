/* =========================================================
   BỘ HẠNG MỤC CHUẨN NGHỀ NỘI THẤT (để trống giá, chủ tự nhập)
   + ĐỔI GIÁ HÀNG LOẠT khi giá vật liệu thay đổi
   + CẬP NHẬT BÁO GIÁ CŨ theo giá mới (bản đã ký giữ nguyên)
   ========================================================= */
const GROUPS = ['Phòng ngủ', 'Tủ quần áo', 'Bếp', 'Thiết bị bếp', 'Phòng khách', 'Phòng làm việc, trẻ em', 'Phòng thờ', 'Phòng tắm', 'Trần, vách, sàn', 'Cửa', 'Điện, đèn', 'Phụ kiện, kính', 'Rèm, trang trí', 'Thiết kế, thi công', 'Khác'];
const M = { mdf: 'MDF chống ẩm phủ Melamine', acr: 'MDF chống ẩm phủ Acrylic', lam: 'MDF chống ẩm phủ Laminate', ply: 'Plywood phủ Melamine', go: 'Gỗ tự nhiên', tc: 'Khung xương + tấm thạch cao', da: 'Đá', kinh: 'Kính cường lực', nhom: 'Nhôm kính', bao: 'Theo mẫu chọn' };
/* [nhóm, tên, vật liệu mặc định, đơn vị] */
const LIBRARY = [
  ['Tủ quần áo', 'Tủ áo cánh mở', M.mdf, 'm²'], ['Tủ quần áo', 'Tủ áo cánh lùa', M.mdf, 'm²'], ['Tủ quần áo', 'Tủ áo kịch trần', M.mdf, 'm²'],
  ['Tủ quần áo', 'Tủ áo góc chữ L', M.mdf, 'm²'], ['Tủ quần áo', 'Tủ áo cánh kính khung nhôm', 'Thùng MDF chống ẩm, cánh kính khung nhôm', 'm²'],
  ['Tủ quần áo', 'Tủ áo cánh Acrylic', M.acr, 'm²'], ['Tủ quần áo', 'Tủ áo cánh Laminate', M.lam, 'm²'], ['Tủ quần áo', 'Tủ áo trẻ em', M.mdf, 'm²'],
  ['Tủ quần áo', 'Tủ áo mở không cánh (walk-in)', M.mdf, 'm²'], ['Tủ quần áo', 'Hộp kệ nóc tủ', M.mdf, 'm²'], ['Tủ quần áo', 'Tủ ngăn kéo', M.mdf, 'cái'],
  ['Phòng ngủ', 'Giường ngủ 1m2', M.mdf, 'bộ'], ['Phòng ngủ', 'Giường ngủ 1m4', M.mdf, 'bộ'], ['Phòng ngủ', 'Giường ngủ 1m6', M.mdf, 'bộ'],
  ['Phòng ngủ', 'Giường ngủ 1m8', M.mdf, 'bộ'], ['Phòng ngủ', 'Giường ngủ 2m2', M.mdf, 'bộ'], ['Phòng ngủ', 'Giường có ngăn kéo', M.mdf, 'bộ'],
  ['Phòng ngủ', 'Giường đầu bọc nỉ / da', 'Khung MDF chống ẩm, đầu giường bọc nỉ', 'bộ'], ['Phòng ngủ', 'Giường tầng trẻ em', M.mdf, 'bộ'],
  ['Phòng ngủ', 'Giường bệt (sàn gỗ)', M.mdf, 'm²'], ['Phòng ngủ', 'Táp đầu giường', M.mdf, 'cái'], ['Phòng ngủ', 'Bàn trang điểm', M.mdf, 'bộ'],
  ['Phòng ngủ', 'Gương trang điểm', 'Gương bỉ, khung theo mẫu', 'cái'], ['Phòng ngủ', 'Ghế đôn trang điểm', M.bao, 'cái'],
  ['Phòng ngủ', 'Vách ốp đầu giường', M.mdf, 'm²'], ['Phòng ngủ', 'Vách ốp đầu giường bọc nỉ / da', 'Cốt MDF, bọc nỉ', 'm²'],
  ['Phòng ngủ', 'Kệ tivi phòng ngủ', M.mdf, 'md'], ['Phòng ngủ', 'Kệ treo tường', M.mdf, 'md'], ['Phòng ngủ', 'Đệm', M.bao, 'cái'],
  ['Bếp', 'Tủ bếp dưới', M.acr, 'md'], ['Bếp', 'Tủ bếp trên', M.acr, 'md'], ['Bếp', 'Tủ bếp trên kịch trần', M.acr, 'md'],
  ['Bếp', 'Tủ bếp chữ L (trên + dưới)', M.acr, 'md'], ['Bếp', 'Tủ đồ khô / tủ cao', M.acr, 'bộ'], ['Bếp', 'Tủ lạnh âm tủ (hộp tủ)', M.acr, 'bộ'],
  ['Bếp', 'Đảo bếp', M.acr, 'md'], ['Bếp', 'Quầy bar', M.acr, 'md'], ['Bếp', 'Mặt đá bếp', 'Đá nhân tạo / đá tự nhiên', 'md'],
  ['Bếp', 'Mặt đá đảo bếp', 'Đá nhân tạo / đá tự nhiên', 'md'], ['Bếp', 'Kính ốp tường bếp', 'Kính cường lực sơn màu', 'md'],
  ['Bếp', 'Gạch ốp tường bếp', M.bao, 'm²'], ['Bếp', 'Tủ bếp nhựa (chống nước)', 'Nhựa Picomat / nhựa PVC', 'md'],
  ['Bếp', 'Giá bát đĩa nâng hạ', 'Inox, ray giảm chấn', 'bộ'], ['Bếp', 'Giá bát đĩa cố định', 'Inox', 'bộ'], ['Bếp', 'Kệ gia vị', 'Inox, ray giảm chấn', 'bộ'],
  ['Bếp', 'Giá xoong nồi', 'Inox, ray giảm chấn', 'bộ'], ['Bếp', 'Thùng gạo âm tủ', M.bao, 'cái'], ['Bếp', 'Thùng rác âm tủ', M.bao, 'cái'],
  ['Bếp', 'Kệ góc liên hoàn', M.bao, 'bộ'], ['Bếp', 'Tủ đồ khô cánh kéo', M.bao, 'bộ'],
  ['Thiết bị bếp', 'Bếp từ', M.bao, 'cái'], ['Thiết bị bếp', 'Máy hút mùi', M.bao, 'cái'], ['Thiết bị bếp', 'Chậu rửa', M.bao, 'cái'],
  ['Thiết bị bếp', 'Vòi rửa', M.bao, 'cái'], ['Thiết bị bếp', 'Lò nướng âm tủ', M.bao, 'cái'], ['Thiết bị bếp', 'Lò vi sóng âm tủ', M.bao, 'cái'],
  ['Thiết bị bếp', 'Máy rửa bát', M.bao, 'cái'], ['Thiết bị bếp', 'Máy lọc nước', M.bao, 'cái'],
  ['Phòng khách', 'Kệ tivi', M.mdf, 'md'], ['Phòng khách', 'Vách tivi ốp', M.mdf, 'm²'], ['Phòng khách', 'Vách tivi ốp đá / tấm nhựa vân đá', M.bao, 'm²'],
  ['Phòng khách', 'Tủ giày', M.mdf, 'm²'], ['Phòng khách', 'Tủ giày kịch trần', M.mdf, 'm²'], ['Phòng khách', 'Tủ rượu', M.mdf, 'm²'],
  ['Phòng khách', 'Tủ trang trí', M.mdf, 'm²'], ['Phòng khách', 'Kệ trang trí', M.mdf, 'md'], ['Phòng khách', 'Vách ngăn CNC', M.mdf, 'm²'],
  ['Phòng khách', 'Vách ngăn lam gỗ', M.mdf, 'm²'], ['Phòng khách', 'Bàn trà', M.bao, 'cái'], ['Phòng khách', 'Sofa', M.bao, 'bộ'],
  ['Phòng khách', 'Bàn ăn', M.bao, 'bộ'], ['Phòng khách', 'Ghế ăn', M.bao, 'cái'], ['Phòng khách', 'Tủ để đồ dưới gầm cầu thang', M.mdf, 'm²'],
  ['Phòng làm việc, trẻ em', 'Bàn làm việc', M.mdf, 'bộ'], ['Phòng làm việc, trẻ em', 'Bàn học kèm giá sách', M.mdf, 'bộ'],
  ['Phòng làm việc, trẻ em', 'Giá sách', M.mdf, 'm²'], ['Phòng làm việc, trẻ em', 'Tủ hồ sơ', M.mdf, 'm²'],
  ['Phòng làm việc, trẻ em', 'Bàn học gấp gọn treo tường', M.mdf, 'bộ'], ['Phòng làm việc, trẻ em', 'Ghế làm việc', M.bao, 'cái'],
  ['Phòng làm việc, trẻ em', 'Kệ đồ chơi', M.mdf, 'md'],
  ['Phòng thờ', 'Bàn thờ', M.go, 'bộ'], ['Phòng thờ', 'Tủ thờ', M.go, 'bộ'], ['Phòng thờ', 'Vách ốp phòng thờ', M.mdf, 'm²'],
  ['Phòng thờ', 'Án gian', M.go, 'bộ'], ['Phòng thờ', 'Vách CNC phòng thờ', M.mdf, 'm²'],
  ['Phòng tắm', 'Tủ lavabo', 'Nhựa Picomat / nhựa PVC', 'bộ'], ['Phòng tắm', 'Gương phòng tắm', 'Gương bỉ chống ẩm', 'cái'],
  ['Phòng tắm', 'Gương đèn LED cảm ứng', M.bao, 'cái'], ['Phòng tắm', 'Kệ phòng tắm', 'Nhựa / inox', 'cái'], ['Phòng tắm', 'Vách kính tắm', M.kinh, 'm²'],
  ['Phòng tắm', 'Tủ treo phòng tắm', 'Nhựa Picomat / nhựa PVC', 'bộ'],
  ['Trần, vách, sàn', 'Trần thạch cao phẳng', M.tc, 'm²'], ['Trần, vách, sàn', 'Trần thạch cao giật cấp', M.tc, 'm²'],
  ['Trần, vách, sàn', 'Trần thạch cao chống ẩm', 'Khung xương + tấm thạch cao chống ẩm', 'm²'], ['Trần, vách, sàn', 'Trần thả 60×60', M.bao, 'm²'],
  ['Trần, vách, sàn', 'Trần nhựa nano / PVC', M.bao, 'm²'], ['Trần, vách, sàn', 'Trần ốp lam gỗ', M.mdf, 'm²'],
  ['Trần, vách, sàn', 'Vách thạch cao', M.tc, 'm²'], ['Trần, vách, sàn', 'Sơn bả trần tường', 'Bả + sơn lót + 2 nước sơn phủ', 'm²'],
  ['Trần, vách, sàn', 'Giấy dán tường', M.bao, 'm²'], ['Trần, vách, sàn', 'Ốp tường lam sóng', M.bao, 'm²'],
  ['Trần, vách, sàn', 'Ốp tường tấm nhựa nano / vân đá', M.bao, 'm²'], ['Trần, vách, sàn', 'Ốp tường gỗ', M.mdf, 'm²'],
  ['Trần, vách, sàn', 'Sàn gỗ công nghiệp', 'Ván sàn 8–12 mm + xốp lót', 'm²'], ['Trần, vách, sàn', 'Sàn nhựa SPC', 'Ván SPC + đế lót', 'm²'],
  ['Trần, vách, sàn', 'Sàn gỗ tự nhiên', M.go, 'm²'], ['Trần, vách, sàn', 'Len chân tường', M.bao, 'md'], ['Trần, vách, sàn', 'Phào chỉ', M.bao, 'md'],
  ['Trần, vách, sàn', 'Nẹp kết thúc / nẹp chuyển sàn', M.bao, 'md'], ['Trần, vách, sàn', 'Lát gạch', M.bao, 'm²'],
  ['Cửa', 'Cửa gỗ công nghiệp phòng ngủ', 'MDF chống ẩm phủ Melamine / Laminate', 'bộ'], ['Cửa', 'Cửa nhựa composite', M.bao, 'bộ'],
  ['Cửa', 'Cửa gỗ tự nhiên', M.go, 'bộ'], ['Cửa', 'Cửa nhôm kính', M.nhom, 'm²'], ['Cửa', 'Cửa kính lùa', M.kinh, 'm²'],
  ['Cửa', 'Cửa lùa âm tường', M.bao, 'bộ'], ['Cửa', 'Khung bao, nẹp cửa', M.bao, 'bộ'], ['Cửa', 'Khóa cửa', M.bao, 'bộ'], ['Cửa', 'Bản lề, chặn cửa', M.bao, 'bộ'],
  ['Điện, đèn', 'Đèn LED hắt tủ', 'LED dây 12V kèm nguồn, nẹp nhôm', 'md'], ['Điện, đèn', 'Đèn LED hắt trần', 'LED dây kèm nguồn', 'md'],
  ['Điện, đèn', 'Đèn âm trần (downlight)', M.bao, 'cái'], ['Điện, đèn', 'Đèn rọi ray', M.bao, 'cái'], ['Điện, đèn', 'Đèn thả trang trí', M.bao, 'cái'],
  ['Điện, đèn', 'Đèn ngủ / đèn đầu giường', M.bao, 'cái'], ['Điện, đèn', 'Cảm biến đèn tủ', M.bao, 'cái'], ['Điện, đèn', 'Đi dây điện, điểm điện mới', 'Dây, ống luồn', 'điểm'],
  ['Điện, đèn', 'Công tắc, ổ cắm', M.bao, 'điểm'],
  ['Phụ kiện, kính', 'Bản lề giảm chấn', M.bao, 'cái'], ['Phụ kiện, kính', 'Ray ngăn kéo giảm chấn', M.bao, 'bộ'], ['Phụ kiện, kính', 'Ray lùa giảm chấn', M.bao, 'bộ'],
  ['Phụ kiện, kính', 'Tay nắm', M.bao, 'cái'], ['Phụ kiện, kính', 'Tay nắm âm / tay nắm nhôm chạy dài', M.bao, 'md'], ['Phụ kiện, kính', 'Ngăn kéo', M.mdf, 'cái'],
  ['Phụ kiện, kính', 'Giá treo quần áo nâng hạ', M.bao, 'bộ'], ['Phụ kiện, kính', 'Thanh treo quần áo', 'Ống nhôm / inox', 'md'],
  ['Phụ kiện, kính', 'Khay chia ngăn kéo', M.bao, 'cái'], ['Phụ kiện, kính', 'Gương soi toàn thân', 'Gương bỉ', 'm²'],
  ['Phụ kiện, kính', 'Kính cường lực', M.kinh, 'm²'], ['Phụ kiện, kính', 'Kính trang trí sơn màu', 'Kính cường lực sơn màu', 'm²'],
  ['Rèm, trang trí', 'Rèm vải', M.bao, 'm²'], ['Rèm, trang trí', 'Rèm cầu vồng', M.bao, 'm²'], ['Rèm, trang trí', 'Rèm cuốn', M.bao, 'm²'],
  ['Rèm, trang trí', 'Ray rèm', M.bao, 'md'], ['Rèm, trang trí', 'Tranh treo tường', M.bao, 'bộ'], ['Rèm, trang trí', 'Thảm', M.bao, 'cái'],
  ['Rèm, trang trí', 'Cây cảnh, đồ trang trí', M.bao, 'gói'],
  ['Thiết kế, thi công', 'Thiết kế 3D nội thất', 'Bản vẽ phối cảnh 3D', 'm²'], ['Thiết kế, thi công', 'Bản vẽ kỹ thuật thi công', M.bao, 'm²'],
  ['Thiết kế, thi công', 'Khảo sát, đo đạc', M.bao, 'gói'], ['Thiết kế, thi công', 'Vận chuyển', M.bao, 'gói'], ['Thiết kế, thi công', 'Lắp đặt', M.bao, 'gói'],
  ['Thiết kế, thi công', 'Tháo dỡ đồ cũ', M.bao, 'gói'], ['Thiết kế, thi công', 'Vệ sinh công nghiệp sau thi công', M.bao, 'gói'],
  ['Thiết kế, thi công', 'Nhân công phát sinh', M.bao, 'công'], ['Thiết kế, thi công', 'Vận chuyển lên tầng (không thang máy)', M.bao, 'gói'],
];
/* đoán nhóm cho hạng mục cũ chưa gán nhóm (theo tên) */
const LIB_GROUP = new Map(LIBRARY.map(x => [x[1].toLowerCase(), x[0]]));
const GUESS = [
  [/tủ (áo|quần áo)|tủ quần|walk-in|nóc tủ/, 'Tủ quần áo'], [/giường|táp|trang điểm|đầu giường|đệm/, 'Phòng ngủ'],
  [/chậu rửa|vòi rửa|hút mùi|bếp từ|lò nướng|lò vi sóng|máy rửa bát|máy lọc/, 'Thiết bị bếp'], [/bếp|đảo|quầy bar|giá bát|gia vị|xoong|thùng gạo|thùng rác|đồ khô/, 'Bếp'],
  [/tivi|sofa|tủ giày|tủ rượu|bàn trà|bàn ăn|ghế ăn|vách ngăn|tủ trang trí|kệ trang trí/, 'Phòng khách'], [/bàn học|bàn làm việc|giá sách|tủ hồ sơ|đồ chơi|ghế làm việc/, 'Phòng làm việc, trẻ em'],
  [/thờ|án gian/, 'Phòng thờ'], [/lavabo|phòng tắm|vách kính tắm/, 'Phòng tắm'],
  [/trần|sàn|vách thạch cao|sơn |sơn$|giấy dán|ốp tường|len chân|phào|lát gạch|nẹp/, 'Trần, vách, sàn'], [/^cửa|cửa |khóa cửa/, 'Cửa'],
  [/đèn|led|ổ cắm|công tắc|điểm điện/, 'Điện, đèn'], [/bản lề|ray |tay nắm|ngăn kéo|kính|gương|giá treo|thanh treo/, 'Phụ kiện, kính'],
  [/rèm|tranh|thảm|cây cảnh/, 'Rèm, trang trí'], [/thiết kế|bản vẽ|khảo sát|vận chuyển|lắp đặt|tháo dỡ|vệ sinh|nhân công/, 'Thiết kế, thi công'],
];
function guessGroup(name) {
  const n = String(name || '').trim().toLowerCase(); if (!n) return 'Khác';
  if (LIB_GROUP.has(n)) return LIB_GROUP.get(n);
  for (const [re, g] of GUESS) if (re.test(n)) return g;
  return 'Khác';
}
const catGroup = c => (c.group && GROUPS.includes(c.group) ? c.group : guessGroup(c.name));
function addLibrary(only) {
  const have = new Set(Store.list('catalog').map(c => c.name.trim().toLowerCase()));
  let n = 0, i = 0;
  for (const [group, name, material, unit] of LIBRARY) {
    if (only && !only.includes(group)) continue;
    if (have.has(name.toLowerCase())) continue;
    Store.put('catalog', { id: uid('k'), name, material, unit, price: 0, group, lib: true }, 40 + (i++) * 60);
    n++;
  }
  return n;
}
function librarySheet() {
  const have = new Set(Store.list('catalog').map(c => c.name.trim().toLowerCase()));
  const per = g => LIBRARY.filter(x => x[0] === g && !have.has(x[1].toLowerCase())).length;
  const groups = GROUPS.filter(g => LIBRARY.some(x => x[0] === g));
  const total = groups.reduce((s, g) => s + per(g), 0);
  const el = openSheet({
    title: 'Bộ hạng mục chuẩn nghề nội thất', cls: 'wide',
    html: `<p>${LIBRARY.length} hạng mục thường gặp, chia theo nhóm, có sẵn vật liệu và đơn vị tính. <b>Giá để trống</b> để bạn tự nhập. Hạng mục đã có (trùng tên) sẽ không thêm lại.</p>
      <div class="libgrid">${groups.map(g => `<label class="check libg"><input type="checkbox" data-lib="${esc(g)}" ${per(g) ? 'checked' : 'disabled'}> <span><b>${esc(g)}</b><small>${per(g) ? per(g) + ' mục mới' : 'đã có đủ'}</small></span></label>`).join('')}</div>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok" ${total ? '' : 'disabled'}>${ic('plus')}Thêm vào danh mục</button>`,
    onClick: (a, b, el2) => {
      if (a !== 'ok') return;
      const only = $$('[data-lib]', el2).filter(x => x.checked).map(x => x.dataset.lib);
      if (!only.length) { toast('Chọn ít nhất một nhóm.', 'bad'); return; }
      const n = addLibrary(only); closeSheet(el2); S.catTab = 'items'; S.catGroup = ''; render();
      toast(`Đã thêm ${n} hạng mục. Nhập giá bán (và giá nhập) ở cột bên phải.`);
    },
  });
  return el;
}

/* ---------- đổi giá hàng loạt ---------- */
const roundK = v => Math.max(0, Math.round(v / 1000) * 1000);
function bulkPriceSheet() {
  const groups = GROUPS.filter(g => Store.list('catalog').some(c => catGroup(c) === g));
  const pick = el => {
    const g = el.querySelector('#bp-group').value, kw = fold(el.querySelector('#bp-kw').value.trim());
    return Store.list('catalog').filter(c => (!g || catGroup(c) === g) && (!kw || fold(c.name + ' ' + c.material).includes(kw)));
  };
  const el = openSheet({
    title: 'Đổi giá hàng loạt',
    html: `<p class="muted">Dùng khi giá vật liệu thay đổi. VD: ván MDF tăng 5% → chọn “Vật liệu có chữ: MDF”, nhập 5.</p>
      <div class="fgrid">
        <div class="field"><label for="bp-group">Nhóm hạng mục</label><select class="in" id="bp-group"><option value="">Tất cả nhóm</option>${groups.map(g => `<option>${esc(g)}</option>`).join('')}</select></div>
        <div class="field"><label for="bp-kw">Tên / vật liệu có chữ</label><input class="in" id="bp-kw" placeholder="VD: MDF, Acrylic, tủ bếp" autocomplete="off"></div>
        <div class="field"><label for="bp-pct">Tăng (+) / giảm (−) bao nhiêu %</label><input class="in num" id="bp-pct" inputmode="decimal" placeholder="VD: 5 hoặc -3" autocomplete="off"></div>
      </div>
      <div class="field"><span class="lbl">Áp dụng cho</span><div class="seg" id="bp-what"><button data-sa="w" data-v="both" aria-pressed="true">Giá bán và giá nhập</button><button data-sa="w" data-v="price" aria-pressed="false">Chỉ giá bán</button><button data-sa="w" data-v="cost" aria-pressed="false">Chỉ giá nhập</button></div></div>
      <div class="calcline" id="bp-prev"></div>
      <p class="muted" style="font-size:14px">Làm tròn đến 1.000 đ. Báo giá và đơn cũ <b>không tự đổi</b>; sau khi đổi giá, app sẽ chỉ ra các báo giá đang dùng giá cũ để bạn chọn cập nhật.</p>`,
    foot: `<button class="btn" data-sa="close">Hủy</button><button class="btn primary" data-sa="ok">Áp dụng</button>`,
    onMount: el => {
      const prev = () => {
        const list = pick(el), pct = parseFloat(String(el.querySelector('#bp-pct').value).replace(',', '.')) || 0;
        const withPrice = list.filter(c => c.price > 0 || catCost(c.id) > 0).length;
        el.querySelector('#bp-prev').innerHTML = `${list.length} hạng mục khớp · ${withPrice} mục đã có giá${pct ? ` · <b>${pct > 0 ? '+' : ''}${QF.format(pct)}%</b>` : ''}`;
      };
      el._prev = prev; el.addEventListener('input', prev); el.addEventListener('change', prev); prev();
    },
    onClick: async (a, b, el2) => {
      if (a === 'w') { segPick(b); return; }
      if (a !== 'ok') return;
      const pct = parseFloat(String(el2.querySelector('#bp-pct').value).replace(',', '.')) || 0;
      if (!pct || pct <= -100) { toast('Nhập số % tăng hoặc giảm.', 'bad'); return; }
      const what = el2.querySelector('#bp-what [aria-pressed=true]').dataset.v, list = pick(el2);
      const doCost = what !== 'price' && canCost(), doPrice = what !== 'cost';
      let n = 0, i = 0; const k = 1 + pct / 100, at = new Date().toISOString();
      for (const c of list) {
        let changed = false;
        if (doPrice && c.price > 0) { Store.put('catalog', { ...c, price: roundK(c.price * k), priceAt: at }, 40 + (i++) * 60); changed = true; }
        if (doCost && catCost(c.id) > 0) { setCatCost(c.id, roundK(catCost(c.id) * k), 40 + (i++) * 60); changed = true; }
        if (changed) n++;
      }
      closeSheet(el2); render();
      const g = el2.querySelector('#bp-group').value, kw = el2.querySelector('#bp-kw').value.trim();
      saveMeta({ priceLog: [...(meta().priceLog || []).slice(-29), { at, pct, what, scope: [g || 'Tất cả nhóm', kw && `“${kw}”`].filter(Boolean).join(' · '), n }] });
      toast(`Đã đổi giá ${n} hạng mục (${pct > 0 ? '+' : ''}${QF.format(pct)}%)`);
      setTimeout(() => { if (staleOrders().length) staleListSheet(); }, 400);
    },
  });
  return el;
}

/* ---------- báo giá đang dùng giá cũ ---------- */
const rowCat = r => (r.kid && Store.get('catalog', r.kid)) || catByName(r.name);
/* các dòng có giá khác danh mục hiện tại */
function staleRows(o, q) {
  q = q || (o.draft || lastVersion(o)?.quote); if (!q) return [];
  const out = [], cd = costDoc(o.id);
  /* mốc so sánh cho dòng cũ chưa ghi giá danh mục: ngày lập bản nháp / lúc chốt bản */
  const ref = o.draft && q === o.draft ? (q.date || '') : (lastVersion(o)?.closedTs || q.date || '');
  for (const r of q.rows || []) {
    const k = rowCat(r); if (!k) continue;
    const np = Number(k.price) || 0, nc = catCost(k.id), cur = Number(r.price) || 0;
    /* chỉ coi là giá cũ khi DANH MỤC đã đổi sau lúc dòng này được báo giá (giá bạn tự sửa riêng cho khách không bị tính) */
    const priceDiff = np > 0 && np !== cur && (r.kp != null ? np !== Number(r.kp) : !!(k.priceAt && k.priceAt > ref));
    const oc = Number(cd.rows?.[r.id]) || 0, kc = cd.kc?.[r.id];
    const costDiff = canCost() && nc > 0 && nc !== oc && kc != null && nc !== Number(kc);
    if (priceDiff || costDiff) out.push({ r, k, op: Number(r.price) || 0, np: priceDiff ? np : (Number(r.price) || 0), oc, nc: costDiff ? nc : oc, priceDiff, costDiff });
  }
  return out;
}
/* chỉ xét đơn còn đang chạy: đang báo giá, đã chốt, đang thi công */
function staleOrders() { return memo('stale', () => Store.list('orders').filter(o => o.status !== 'done' && staleRows(o).length)); }
function staleListSheet() {
  const list = staleOrders().sort((a, b) => (a.status === 'quote' ? 0 : 1) - (b.status === 'quote' ? 0 : 1));
  const el = openSheet({
    title: 'Báo giá đang dùng giá cũ', cls: 'wide',
    html: list.length ? `<p class="muted">Giá trong danh mục đã đổi. Chọn đơn để xem chênh lệch và cập nhật. Đơn đã chốt sẽ được tạo <b>bản mới</b>; bản khách đã ký giữ nguyên.</p>
      <div class="pick-list">${list.map(o => { const s = staleRows(o), q = o.draft || lastVersion(o).quote, d = s.reduce((t, x) => t + Math.round((Number(x.r.qty) || 0) * (x.np - x.op)), 0);
        return `<button class="pick" data-sa="go" data-id="${o.id}"><div class="pm"><b>${esc(q.customer?.name || o.code)} <span class="muted" style="font-weight:400">· ${esc(o.code)}</span></b><span><span class="pill ${STATUS[o.status].cls}">${STATUS[o.status].label}</span> ${s.length} dòng đổi giá</span></div><div class="pp ${d > 0 ? 'negt' : ''}">${d ? signed(d) + ' đ' : 'đổi giá nhập'}</div></button>`; }).join('')}</div>` : `<div class="empty">Không có báo giá nào đang dùng giá cũ.</div>`,
    onClick: (a, b, el2) => { if (a !== 'go') return; const o = Store.get('orders', b.dataset.id); closeSheet(el2); if (o) { S.tab = 'orders'; S.orderId = o.id; S.view = !isClosed(o) && can('quote') ? 'edit' : 'detail'; render(); repriceSheet(o); } },
  });
  return el;
}
function repriceSheet(o) {
  if (!can('quote')) { toast('Vai trò của bạn không sửa báo giá.', 'bad'); return; }
  const s = staleRows(o);
  if (!s.length) { toast('Báo giá này đã theo giá mới nhất trong danh mục.'); return; }
  const closed = isClosed(o), hasDraft = !!o.draft;
  const q = o.draft || lastVersion(o).quote;
  const tot = sel => { const rows = q.rows.map(r => { const x = s.find(y => y.r.id === r.id && sel.has(r.id)); return x ? { ...r, price: x.np } : r; }); return quoteTotals({ ...q, rows }).total; };
  const el = openSheet({
    title: 'Cập nhật theo giá mới', cls: 'wide',
    html: `<p class="muted">${esc(q.customer?.name || '')} · ${esc(o.code)}${closed && !hasDraft ? ` · <b>Đơn đã chốt: sẽ tạo bản ${o.versions.length + 1}</b>, bản ${o.versions.length} khách đã ký giữ nguyên` : hasDraft && closed ? ` · cập nhật vào bản ${o.versions.length + 1} đang sửa` : ''}</p>
      <div class="cost-list">
        <div class="cost-row cost-head rp"><div></div><div>Hạng mục</div><div class="r">Giá cũ</div><div class="r">Giá mới</div><div class="r">Chênh lệch</div></div>
        ${s.map(x => `<label class="cost-row rp"><input type="checkbox" data-rp="${x.r.id}" checked><div><b>${esc(x.r.name)}</b><span class="sub">${fmtQty(x.r.qty)} ${esc(x.r.unit)}${x.costDiff ? ` · giá nhập ${money(x.oc)} → ${money(x.nc)}` : ''}</span></div><div class="r num">${money(x.op)}</div><div class="r num"><b>${money(x.np)}</b></div><div class="r num ${x.np > x.op ? 'negt' : ''}">${x.np !== x.op ? signed(Math.round((Number(x.r.qty) || 0) * (x.np - x.op))) : '–'}</div></label>`).join('')}
      </div>
      <div class="calcline" id="rp-tot"></div>`,
    foot: `<button class="btn" data-sa="close">Để sau</button><button class="btn primary" data-sa="ok">${ic('check')}${closed && !hasDraft ? `Tạo bản ${o.versions.length + 1} với giá mới` : 'Cập nhật giá'}</button>`,
    onMount: el => {
      const upd = () => { const sel = new Set($$('[data-rp]', el).filter(x => x.checked).map(x => x.dataset.rp)); const a = quoteTotals(q).total, b2 = tot(sel); el.querySelector('#rp-tot').innerHTML = `Tổng báo giá: ${money(a)} → <b>${money(b2)} đ</b> (${signed(b2 - a)} đ)`; };
      el.addEventListener('change', upd); upd();
    },
    onClick: (a, b, el2) => {
      if (a !== 'ok') return;
      const sel = new Set($$('[data-rp]', el2).filter(x => x.checked).map(x => x.dataset.rp));
      if (!sel.size) { toast('Chọn ít nhất một dòng.', 'bad'); return; }
      closeSheet(el2); applyReprice(o, s.filter(x => sel.has(x.r.id)));
    },
  });
  return el;
}
function applyReprice(o, items) {
  const before = quoteTotals(o.draft || lastVersion(o).quote).total;
  let created = false;
  if (!o.draft) {
    /* đơn đã chốt: tạo bản mới, mang theo giá nhập */
    const { idMap } = Orders.revise(o); created = true;
    items = items.map(x => ({ ...x, r: { ...x.r, id: idMap[x.r.id] } }));
  }
  const costRows = {};
  for (const x of items) {
    const r = o.draft.rows.find(y => y.id === x.r.id); if (!r) continue;
    r.price = x.np; r.kid = x.k.id; r.kp = Number(x.k.price) || x.np;
    if (x.costDiff) costRows[r.id] = x.nc;
  }
  if (Object.keys(costRows).length) saveCostDoc(o.id, { rows: costRows, kc: costRows }, 0);
  const after = quoteTotals(o.draft).total;
  addLog(o, `${created ? `Tạo bản ${o.versions.length + 1} để c` : 'C'}ập nhật ${items.length} dòng theo giá mới trong danh mục: ${money(before)} → ${money(after)}`);
  touchOrder(o, 0);
  S.tab = 'orders'; S.orderId = o.id; S.view = 'edit'; render();
  toast(created ? `Đã tạo bản ${o.versions.length + 1} với giá mới. Gửi khách xem rồi bấm “Chốt bản ${o.versions.length + 1}”.` : 'Đã cập nhật giá mới vào báo giá');
}
