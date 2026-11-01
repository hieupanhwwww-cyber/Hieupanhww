/* =========================================================
   ĐƠN HÀNG — quy tắc nghiệp vụ của một đơn, không đụng tới màn hình.
   Màn hình chỉ hỏi thông tin (ngày, số tiền, chữ ký…) rồi gọi vào đây;
   vẽ lại, thông báo, mở hộp thoại là việc của màn hình.

   Orders.close(đơn, { date, deposit, method, sig, signer })  chốt đơn / chốt bản sửa
   Orders.revise(đơn)                                         tạo bản sửa mới từ bản chốt
   Orders.pay(đơn, { amount, date, method, note, deposit })   ghi tiền khách trả
   Orders.setStatus(đơn, trạngThái)                           đổi trạng thái

   Mỗi hàm sửa đơn, ghi lịch sử, lưu lại, và trả về kết quả cho màn hình.
   ========================================================= */
const Orders = {
  async close(o, { date = today(), deposit = 0, method = 'transfer', sig = null, signer = '' } = {}) {
    const q = o.draft; if (!q) return null;
    q.rows = q.rows.filter(r => r.name.trim() || rowAmount(r));
    const t = quoteTotals(q), first = !o.versions.length;
    const v = { no: o.versions.length + 1, quote: clone(q), sub: t.sub, disc: t.disc, total: t.total, closedAt: date, closedTs: new Date().toISOString() };
    delete v.quote.planBak;
    if (sig) v.sign = await makeSignRecord(sig, signer, { code: o.code, no: v.no, quote: v.quote, total: v.total });
    /* khóa giá nhập theo danh mục lúc chốt: đổi danh mục sau này không làm đổi lãi đơn cũ */
    const cd = costDoc(o.id), frz = {};
    for (const r of q.rows) if (cd.rows?.[r.id] == null) { const k = rowCat(r); if (k && catCost(k.id)) frz[r.id] = catCost(k.id); }
    if (Object.keys(frz).length) saveCostDoc(o.id, { rows: frz, kc: frz }, 0);
    o.versions.push(v); o.draft = null;
    /* lịch của đơn theo bản vừa chốt; đợt cùng mã giữ lại ngày hẹn đã đặt */
    o.plan = mergePlan(o.plan, v.quote.plan || []);
    if (first) { o.status = 'closed'; o.closedAt = date; addLog(o, `Chốt đơn ngày ${fmtDate(date)}: ${moneyD(t.total)}`); }
    else addLog(o, `Chốt bản ${v.no} ngày ${fmtDate(date)}: ${moneyD(o.versions[v.no - 2].total)} → ${moneyD(t.total)}`);
    if (v.sign) addLog(o, `Khách ${v.sign.name} ký xác nhận bản ${v.no} (mã ${v.sign.hash})`);
    if (deposit > 0 && first) Orders.pay(o, { amount: deposit, date, method, note: 'Đặt cọc khi chốt đơn', deposit: true, save: false });
    o.customerId = upsertCustomer(q.customer) || o.customerId;
    touchOrder(o, 0);
    return { first, version: v };
  },

  /* bản sửa mới: chép bản chốt cuối với mã dòng mới, mang theo giá nhập và lịch hiện tại của đơn */
  revise(o) {
    if (!o || o.draft || !o.versions.length) return null;
    const q = clone(lastVersion(o).quote), idMap = {};
    q.date = today(); q.rows = q.rows.map(r => { const id = uid('r'); idMap[r.id] = id; return { ...r, id }; });
    q.plan = Array.isArray(o.plan) ? planCopy(o.plan) : Array.isArray(q.plan) ? q.plan : newPlan(); delete q.planBak;
    carryRowCosts(o.id, o.id, idMap);
    o.draft = q;
    return { no: o.versions.length + 1, idMap };
  },

  /* người có quyền thu: ghi phiếu thu. Sale: gửi yêu cầu chờ chủ/kế toán xác nhận */
  pay(o, { amount, date = today(), method = 'transfer', note = '', deposit = false, save = true }) {
    const v = Math.round(Number(amount) || 0); if (v <= 0) return null;
    let res;
    if (!can('pay')) {
      const req = { id: uid('q'), amount: v, date, method, note, by: Team.uid(), byName: Team.myName(), status: 'pending', createdAt: new Date().toISOString() };
      (o.payReqs ||= []).push(req);
      addLog(o, deposit ? `Báo đã thu đặt cọc ${moneyD(v)} (${PAY_METHOD[method]}), chờ xác nhận` : `Báo đã thu ${moneyD(v)} ngày ${fmtDate(date)} (${PAY_METHOD[method]}), chờ xác nhận`);
      res = { kind: 'request', req };
    } else {
      const p = { id: uid('p'), no: nextPayNo(o), amount: v, date, method, note, createdAt: new Date().toISOString() };
      o.payments.push(p);
      addLog(o, deposit ? `Ghi nhận đặt cọc ${moneyD(v)} (${PAY_METHOD[method]})` : `Thu ${moneyD(v)} ngày ${fmtDate(date)} (${PAY_METHOD[method]})${note ? ' – ' + note : ''}`);
      res = { kind: 'payment', payment: p };
    }
    if (save) touchOrder(o, 0);
    return res;
  },

  setStatus(o, s) {
    if (!o || !STATUS[s] || o.status === s) return false;
    const from = STATUS[o.status].label; o.status = s;
    addLog(o, `Đổi trạng thái: ${from} → ${STATUS[s].label}`); touchOrder(o, 0);
    return true;
  },
};
const nextPayNo = o => (o.payments || []).reduce((m, p) => Math.max(m, p.no || 0), 0) + 1;
