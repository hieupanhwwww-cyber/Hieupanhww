// Kiểm thử luật bảo mật trên máy chủ giả lập Firestore (chạy trong GitHub Actions)
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

let pass = 0, fail = 0;
async function t(name, fn) {
  try { await fn(); pass++; console.log('PASS', name); }
  catch (e) { fail++; console.log('FAIL', name, '::', e && e.message ? e.message.split('\n')[0] : e); }
}

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-snt',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8080 },
  });
  const TS = firebase.firestore.Timestamp;
  await env.withSecurityRulesDisabled(async ctx => {
    const db = ctx.firestore(), w = db.collection('w').doc('main');
    await w.set({ createdBy: 'O', name: 'Hùng Loan' });
    const m = (uid, role, active = true) => w.collection('members').doc(uid).set({ role, name: uid, email: uid + '@x.vn', active, joinedAt: 'x' });
    await Promise.all([m('O', 'owner'), m('M', 'manager'), m('S1', 'sale'), m('S2', 'sale'), m('K', 'worker'), m('X', 'sale', false)]);
    await w.collection('orders').doc('o1').set({ owner: 'S1', code: 'BG2610-01', payments: [], draft: { rows: [{ price: 3000000 }] } });
    await w.collection('orders').doc('o2').set({ owner: 'O', code: 'BG2610-02', payments: [{ id: 'p1', amount: 10 }] });
    await w.collection('jobs').doc('o1').set({ owner: 'S1', assignees: ['K'], items: [{ name: 'Tủ áo' }] });
    await w.collection('catalog').doc('k1').set({ name: 'Tủ', price: 1 });
    await w.collection('app').doc('settings').set({ shopName: 'HL' });
    await w.collection('customers').doc('c1').set({ owner: 'S1', name: 'Mai' });
    await w.collection('counters').doc('BG2610').set({ n: 2 });
    await w.collection('invites').doc('INVSALE1').set({ role: 'sale', used: false, createdBy: 'O', exp: TS.fromMillis(Date.now() + 864e5) });
    await w.collection('invites').doc('INVOLD01').set({ role: 'sale', used: false, createdBy: 'O', exp: TS.fromMillis(Date.now() - 1000) });
    await w.collection('invites').doc('INVWORK1').set({ role: 'worker', used: false, createdBy: 'O', exp: TS.fromMillis(Date.now() + 864e5) });
  });
  const as = uid => (uid ? env.authenticatedContext(uid, { email: uid + '@x.vn' }) : env.unauthenticatedContext()).firestore().collection('w').doc('main');

  await t('chưa đăng nhập: không đọc được đơn', () => assertFails(as(null).collection('orders').doc('o1').get()));
  await t('người ngoài: không đọc được đơn', () => assertFails(as('Z').collection('orders').doc('o1').get()));
  await t('người ngoài: không xem được danh sách nhân viên', () => assertFails(as('Z').collection('members').get()));
  await t('tài khoản bị khóa: không đọc được', () => assertFails(as('X').collection('orders').doc('o1').get()));
  await t('chủ: đọc mọi đơn', () => assertSucceeds(as('O').collection('orders').get()));
  await t('kế toán: đọc mọi đơn', () => assertSucceeds(as('M').collection('orders').get()));
  await t('sale: đọc đơn mình', () => assertSucceeds(as('S1').collection('orders').doc('o1').get()));
  await t('sale: không đọc đơn người khác', () => assertFails(as('S1').collection('orders').doc('o2').get()));
  await t('sale: lọc theo đơn mình thì được', () => assertSucceeds(as('S1').collection('orders').where('owner', '==', 'S1').get()));
  await t('sale: xem cả danh sách đơn thì bị chặn', () => assertFails(as('S1').collection('orders').get()));
  await t('sale khác: không đọc đơn của S1', () => assertFails(as('S2').collection('orders').doc('o1').get()));
  await t('sale: đọc đơn chưa tồn tại (bước tạo mới) được', () => assertSucceeds(as('S1').collection('orders').doc('moi').get()));
  await t('thợ: không đọc được đơn có giá', () => assertFails(as('K').collection('orders').doc('o1').get()));
  await t('thợ: không đọc được danh mục giá', () => assertFails(as('K').collection('catalog').get()));
  await t('thợ: không đọc được khách', () => assertFails(as('K').collection('customers').doc('c1').get()));
  await t('thợ: đọc phiếu công việc được giao', () => assertSucceeds(as('K').collection('jobs').where('assignees', 'array-contains', 'K').get()));
  await t('sale khác: không đọc phiếu công việc của S1', () => assertFails(as('S2').collection('jobs').doc('o1').get()));
  await t('sale: tạo đơn của mình', () => assertSucceeds(as('S1').collection('orders').doc('o3').set({ owner: 'S1', payments: [] })));
  await t('sale: không tạo đơn đứng tên người khác', () => assertFails(as('S1').collection('orders').doc('o4').set({ owner: 'S2', payments: [] })));
  await t('sale: không tự ghi phiếu thu', () => assertFails(as('S1').collection('orders').doc('o1').set({ owner: 'S1', payments: [{ id: 'px', amount: 5 }] })));
  await t('sale: sửa ghi chú đơn mình', () => assertSucceeds(as('S1').collection('orders').doc('o1').set({ owner: 'S1', payments: [], notes: [{ id: 'n1' }] })));
  await t('sale: không chuyển đơn cho người khác', () => assertFails(as('S1').collection('orders').doc('o1').set({ owner: 'S2', payments: [] })));
  await t('kế toán: ghi thêm phiếu thu', () => assertSucceeds(as('M').collection('orders').doc('o2').set({ owner: 'O', payments: [{ id: 'p1', amount: 10 }, { id: 'p2', amount: 20 }] })));
  await t('kế toán: không xóa phiếu thu', () => assertFails(as('M').collection('orders').doc('o2').set({ owner: 'O', payments: [] })));
  await t('kế toán: không xóa đơn', () => assertFails(as('M').collection('orders').doc('o2').delete()));
  await t('chủ: xóa được phiếu thu ghi nhầm', () => assertSucceeds(as('O').collection('orders').doc('o2').set({ owner: 'O', payments: [{ id: 'p1', amount: 10 }] })));
  await t('sale: không sửa danh mục giá', () => assertFails(as('S1').collection('catalog').doc('k1').set({ name: 'Tủ', price: 0 })));
  await t('kế toán: sửa danh mục giá', () => assertSucceeds(as('M').collection('catalog').doc('k1').set({ name: 'Tủ', price: 2 })));
  await t('kế toán: không sửa cài đặt cửa hàng', () => assertFails(as('M').collection('app').doc('settings').set({ shopName: 'X' })));
  await t('sale: đọc cài đặt để in báo giá', () => assertSucceeds(as('S1').collection('app').doc('settings').get()));
  await t('số báo giá: tăng 1 được', () => assertSucceeds(as('S1').collection('counters').doc('BG2610').set({ n: 3 })));
  await t('số báo giá: nhảy cóc bị chặn', () => assertFails(as('S1').collection('counters').doc('BG2610').set({ n: 9 })));
  await t('thợ: không lấy số báo giá', () => assertFails(as('K').collection('counters').doc('BG2610').set({ n: 4 })));

  const join = (uid, code, role) => {
    const w = as(uid), b = w.firestore.batch();
    b.set(w.collection('members').doc(uid), { role, name: uid, email: uid + '@x.vn', active: true, joinedAt: 'x', invite: code });
    b.update(w.collection('invites').doc(code), { used: true, usedBy: uid, usedAt: 'x' });
    return b.commit();
  };
  await t('mã mời: không tự nâng lên chủ', () => assertFails(join('N1', 'INVSALE1', 'owner')));
  await t('mã mời: không đổi sang vai trò khác mã', () => assertFails(join('N1', 'INVSALE1', 'manager')));
  await t('mã mời hết hạn: bị chặn', () => assertFails(join('N2', 'INVOLD01', 'sale')));
  await t('mã mời hợp lệ: vào xưởng đúng vai trò', () => assertSucceeds(join('N1', 'INVSALE1', 'sale')));
  await t('mã mời đã dùng: người khác không dùng lại được', () => assertFails(join('N3', 'INVSALE1', 'sale')));
  await t('người mới vào: chỉ thấy đơn của mình', () => assertFails(as('N1').collection('orders').doc('o1').get()));
  await t('tự ghi tên mình làm thành viên không có mã: bị chặn', () => assertFails(as('N4').collection('members').doc('N4').set({ role: 'sale', name: 'a', email: 'a', active: true, joinedAt: 'x' })));
  const boot = (uid, wid) => {
    const db = env.authenticatedContext(uid).firestore(), w = db.collection('w').doc(wid), b = db.batch();
    b.set(w, { createdBy: uid, createdAt: 'x', name: 'X' });
    b.set(w.collection('members').doc(uid), { role: 'owner', name: uid, email: '', active: true, joinedAt: 'x' });
    return b.commit();
  };
  await t('chiếm xưởng đã có: bị chặn', () => assertFails(boot('B', 'main')));
  await t('tạo xưởng mới chưa có: được', () => assertSucceeds(boot('B', 'other')));
  await t('chủ: đổi vai trò nhân viên', () => assertSucceeds(as('O').collection('members').doc('S2').update({ role: 'manager' })));
  await t('chủ: không phong thêm chủ', () => assertFails(as('O').collection('members').doc('S2').update({ role: 'owner' })));
  await t('chủ: khóa nhân viên', () => assertSucceeds(as('O').collection('members').doc('S2').update({ active: false })));
  await t('nhân viên bị khóa: mất quyền đọc ngay', () => assertFails(as('S2').collection('catalog').get()));
  await t('sale: không tự đổi vai trò', () => assertFails(as('S1').collection('members').doc('S1').update({ role: 'manager' })));
  await t('chủ: tạo mã mời', () => assertSucceeds(as('O').collection('invites').doc('NEWCODE1').set({ role: 'sale', used: false, createdBy: 'O', exp: TS.fromMillis(Date.now() + 7 * 864e5), createdAt: 'x' })));
  await t('kế toán: không tạo mã mời', () => assertFails(as('M').collection('invites').doc('NEWCODE2').set({ role: 'sale', used: false, createdBy: 'M', exp: TS.fromMillis(Date.now() + 864e5) })));
  await t('chủ: không tạo mã mời vai trò chủ', () => assertFails(as('O').collection('invites').doc('NEWCODE3').set({ role: 'owner', used: false, createdBy: 'O', exp: TS.fromMillis(Date.now() + 864e5) })));

  await env.cleanup();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
