// Kiểm thử gộp 3 chiều (không cần máy chủ)
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/../parts/team.js', 'utf8');
const start = src.indexOf('const META_KEYS'), end = src.indexOf('function replaceInPlace');
const pad2 = n => String(n).padStart(2, '0'); let k = 0; const uid = p => p + (++k);
const M = new Function('pad2', 'uid', src.slice(start, end) + '; return { mergeDoc, mergeArr, fixNumbers, J };')(pad2, uid);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('PASS', m); } else { fail++; console.log('FAIL', m); } };
const base = { id: 'o1', status: 'closed', draft: null, plan: [{ id: 'd1', pct: 50 }], customer: { name: 'A', phone: '1' },
  payments: [{ id: 'p1', no: 1, amount: 10 }], notes: [], log: [{ id: 'l1', at: 't1', text: 'x' }], changes: [{ id: 'g1', status: 'pending' }] };
const c = o => JSON.parse(JSON.stringify(o));
// 1. hai người cùng thêm phiếu thu → giữ cả hai
let mine = c(base), theirs = c(base);
mine.payments.push({ id: 'pA', no: 2, amount: 20 }); theirs.payments.push({ id: 'pB', no: 2, amount: 30 });
let r = M.mergeDoc(base, mine, theirs); M.fixNumbers(r.doc, theirs);
ok(r.doc.payments.length === 3 && !r.conflicts.length, 'hai phiếu thu cùng lúc đều được giữ');
ok(new Set(r.doc.payments.map(p => p.no)).size === 3 && r.doc.payments.find(p => p.id === 'pA').no === 3, 'số phiếu trùng được đổi sang số kế tiếp');
ok(r.doc.log.some(l => /trùng/.test(l.text)), 'ghi lịch sử khi đổi số phiếu');
// 2. sale sửa ghi chú, kế toán thêm phiếu thu (ví dụ trong báo cáo)
mine = c(base); theirs = c(base);
mine.notes.push({ id: 'n1', text: 'khách đổi màu' }); theirs.payments.push({ id: 'pC', no: 2, amount: 20000000 });
r = M.mergeDoc(base, mine, theirs);
ok(r.doc.notes.length === 1 && r.doc.payments.length === 2 && !r.conflicts.length, 'phiếu thu 20 triệu không bị mất khi người khác lưu bản cũ');
// 3. khác khóa: tự gộp, không xung đột
mine = c(base); theirs = c(base); mine.status = 'building'; theirs.plan[0].due = '2026-11-01';
r = M.mergeDoc(base, mine, theirs);
ok(r.doc.status === 'building' && r.doc.plan[0].due === '2026-11-01' && !r.conflicts.length, 'sửa hai chỗ khác nhau: gộp cả hai');
// 4. cùng sửa một chỗ: giữ bản máy chủ, báo xung đột
mine = c(base); theirs = c(base); mine.status = 'building'; theirs.status = 'done';
r = M.mergeDoc(base, mine, theirs);
ok(r.doc.status === 'done' && r.conflicts.includes('status'), 'cùng sửa trạng thái: báo xung đột');
// 5. xóa ghi chú bên này, bên kia không đụng → xóa
const b2 = c(base); b2.notes = [{ id: 'n1', text: 'a' }, { id: 'n2', text: 'b' }];
mine = c(b2); theirs = c(b2); mine.notes = mine.notes.filter(n => n.id !== 'n1'); theirs.notes.push({ id: 'n3', text: 'c' });
r = M.mergeDoc(b2, mine, theirs);
ok(r.doc.notes.map(n => n.id).join() === 'n2,n3', 'xóa ghi chú được giữ, ghi chú mới của người kia vẫn còn');
// 6. thứ tự khóa khác nhau không bị coi là sửa
theirs = c(base); theirs.customer = { phone: '1', name: 'A' }; mine = c(base); mine.status = 'done';
r = M.mergeDoc(base, mine, theirs);
ok(!r.conflicts.length && r.doc.status === 'done', 'khác thứ tự khóa không sinh xung đột giả');
// 7. khóa của sale: không ghi được phiếu thu
mine = c(base); theirs = c(base); mine.payments.push({ id: 'pX', no: 2, amount: 1 });
r = M.mergeDoc(base, mine, theirs, ['payments']);
ok(r.doc.payments.length === 1, 'sale không chèn được phiếu thu (lấy theo máy chủ)');
// 8. xác nhận phát sinh bên này, thêm phát sinh bên kia
mine = c(base); theirs = c(base); mine.changes[0].status = 'confirmed'; theirs.changes.push({ id: 'g2', status: 'pending' });
r = M.mergeDoc(base, mine, theirs);
ok(r.doc.changes.find(x => x.id === 'g1').status === 'confirmed' && r.doc.changes.length === 2, 'xác nhận phát sinh và thêm phát sinh cùng lúc');
// 9. hai người cùng chốt bản mới khi mất mạng → giữ cả hai bản, đánh số lại
const b3 = c(base); b3.versions = [{ no: 1, closedTs: 'a', total: 100 }];
mine = c(b3); theirs = c(b3); mine.versions.push({ no: 2, closedTs: 'b', total: 120 }); theirs.versions.push({ no: 2, closedTs: 'c', total: 130 });
r = M.mergeDoc(b3, mine, theirs); M.fixNumbers(r.doc, theirs);
ok(r.doc.versions.length === 3 && r.doc.versions.map(v => v.no).join() === '1,2,3', 'hai bản chốt cùng lúc: giữ cả hai, đánh số 2 và 3');
// 10. bỏ bản nháp (draft = null) bên này, bên kia không đụng
const b4 = c(base); b4.draft = { rows: [1] }; mine = c(b4); theirs = c(b4); mine.draft = null;
r = M.mergeDoc(b4, mine, theirs); ok(r.doc.draft === null, 'hủy bản nháp được giữ');
// 11. không có bản gốc (lưu từ hàng chờ cũ)
r = M.mergeDoc(null, { id: 'x', a: 1 }, { a: 2, b: 3 });
ok(r.doc.b === 3, 'thiếu bản gốc vẫn gộp không lỗi');
console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
