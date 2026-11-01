# Kiểm thử mô-đun Đơn hàng (Orders): chốt, tạo bản mới, thu tiền, đổi trạng thái — gọi thẳng, không qua màn hình
import threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8791),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]; errs=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8791/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    r=page.evaluate("""async () => {
      const q = newQuote(); q.customer = { name: 'Chị Hà', phone: '0912000111', address: '' };
      q.rows = [newRow({ name: 'Tủ áo', unit: 'bộ', qty: 1, price: 30000000 }), newRow({ name: '', price: 0 })];
      const o = createOrderFrom(q); Store.put('orders', o, 0);
      const c = await Orders.close(o, { date: today(), deposit: 9000000, method: 'cash' });
      const after = { first: c.first, no: c.version.no, status: o.status, rows: o.versions[0].quote.rows.length, plan: o.plan.length, pays: o.payments.map(p => [p.amount, p.method, p.no]), cust: !!Store.get('customers', o.customerId), log: o.log.map(l => l.text) };
      o.plan[1].due = addDays(today(), 5);
      const rv = Orders.revise(o);
      const again = Orders.revise(o);
      const draft = { no: rv.no, rows: o.draft.rows.length, newIds: Object.values(rv.idMap).every(id => o.draft.rows.some(r => r.id === id)), planIds: o.draft.plan.map(r => r.id).join() === o.plan.map(r => r.id).join() };
      o.draft.rows[0].price = 33000000;
      const c2 = await Orders.close(o, { date: today(), deposit: 5000000 });
      const v2 = { first: c2.first, no: c2.version.no, pays: o.payments.length, dueKept: o.plan[1].due === addDays(today(), 5) };
      const pay = Orders.pay(o, { amount: 6000000, note: 'Đợt 2' });
      const zero = Orders.pay(o, { amount: 0 });
      const st1 = Orders.setStatus(o, 'building'), st2 = Orders.setStatus(o, 'building'), st3 = Orders.setStatus(o, 'xyz');
      return { after, again, draft, v2, pay: [pay.kind, pay.payment.amount, pay.payment.no], zero, st: [st1, st2, st3, o.status], money: orderMoney(o).due, saved: Store.get('orders', o.id) === o };
    }""")
    a=r['after']
    check('chốt đơn: lần đầu, bản 1, trạng thái Đã chốt', a['first'] and a['no']==1 and a['status']=='closed')
    check('chốt đơn: bỏ dòng trống', a['rows']==1)
    check('chốt đơn: lịch đơn theo bản chốt', a['plan']==3)
    check('chốt đơn: ghi cọc thành phiếu thu số 1', a['pays']==[[9000000,'cash',1]], a['pays'])
    check('chốt đơn: lưu khách', a['cust'])
    check('chốt đơn: lịch sử có chốt và cọc', any('Chốt đơn ngày' in t for t in a['log']) and any('Ghi nhận đặt cọc' in t for t in a['log']), a['log'])
    d=r['draft']
    check('tạo bản mới: bản 2, mã dòng mới, giữ mã đợt', d['no']==2 and d['newIds'] and d['planIds'], d)
    check('tạo bản mới khi đang có bản nháp: không làm gì', r['again'] is None)
    v=r['v2']
    check('chốt bản 2: không phải lần đầu, không ghi thêm cọc', (not v['first']) and v['no']==2 and v['pays']==1, v)
    check('chốt bản 2: giữ ngày hẹn của đợt', v['dueKept'])
    check('thu tiền: phiếu thu số 2', r['pay']==['payment',6000000,2], r['pay'])
    check('thu tiền 0 đ: bỏ qua', r['zero'] is None)
    check('đổi trạng thái: chỉ đổi khi khác và hợp lệ', r['st']==[True,False,False,'building'], r['st'])
    check('còn phải thu = 33 − 9 − 6 = 18tr', r['money']==18000000, r['money'])
    check('đơn đã được lưu', r['saved'])
    check('không lỗi JS', not errs, errs)
    b.close()
srv.shutdown()
print(f"{sum(res)}/{len(res)} passed")
