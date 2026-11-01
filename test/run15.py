# Kiểm thử: doanh thu tháng giống nhau giữa màn Doanh thu và mục Lãi theo đơn chốt (Cộng sổ)
import threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8792),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]; errs=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8792/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    r=page.evaluate("""async () => {
      const m2 = today().slice(0, 7), d1x = new Date(); d1x.setDate(1); d1x.setMonth(d1x.getMonth() - 1); const m1 = dstr(d1x).slice(0, 7);
      const q = newQuote(); q.customer = { name: 'Anh Bình', phone: '', address: '' }; q.rows = [newRow({ name: 'Tủ bếp', unit: 'md', qty: 4, price: 5000000 })];
      const o = createOrderFrom(q); Store.put('orders', o, 0);
      await Orders.close(o, { date: m1 + '-12' });
      Orders.revise(o); o.draft.rows[0].qty = 5; await Orders.close(o, { date: m2 + '-03' });
      o.changes.push({ id: 'c1', title: 'Thêm đèn', amount: 1500000, sign: 1, status: 'confirmed', confirmedAt: m2 + '-05' }); touchOrder(o, 0);
      const rev = m => { const [y, mm] = m.split('-').map(Number); return computeStats(m + '-01', dstr(new Date(y, mm, 0))).value; };
      const A = accrual([m1, m2]);
      return { m1: [rev(m1), A[0].rev, A[0].orders.filter(x => !x.adj).length], m2: [rev(m2), A[1].rev, A[1].orders.filter(x => !x.adj).length, A[1].orders.length], total: orderTotal(o) };
    }""")
    check('tháng chốt: Doanh thu = Cộng sổ = 20tr, 1 đơn chốt', r['m1']==[20000000,20000000,1], r['m1'])
    check('tháng sau: sửa giá 5tr + phát sinh 1,5tr = 6,5tr ở cả hai màn, không đếm thêm đơn chốt', r['m2']==[6500000,6500000,0,1], r['m2'])
    check('tổng hai tháng = giá trị đơn 26,5tr', r['m1'][0]+r['m2'][0]==r['total']==26500000, r['total'])
    page.evaluate("() => { S.tab='stats'; S.fin='pl'; render(); }"); page.wait_for_timeout(200)
    page.evaluate("() => plMonthSheet(today().slice(0,7))"); page.wait_for_timeout(200)
    t=page.locator('.sheet').last.inner_text()
    check('sổ tháng: hiện dòng sửa giá, phát sinh của đơn', 'Sửa giá, phát sinh trong tháng +6.500.000' in t, t[:200].replace('\n',' '))
    check('không lỗi JS', not errs, errs)
    b.close()
srv.shutdown()
print(f"{sum(res)}/{len(res)} passed")
