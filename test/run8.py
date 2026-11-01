# Kiểm thử: bộ hạng mục chuẩn, đổi giá hàng loạt, cập nhật báo giá cũ
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out8'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8778),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8778/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    page.evaluate("() => { S.tab='catalog'; render(); }")
    page.screenshot(path=f'{OUT}/1-trong.png')
    page.click('.empty [data-act=lib-open]'); page.wait_for_selector('[data-lib]')
    page.screenshot(path=f'{OUT}/2-bo-chuan.png')
    page.click('.sheet [data-sa=ok]'); page.wait_for_timeout(200)
    page.evaluate("() => Store.idle(15000)")
    n=page.evaluate("() => Store.list('catalog').length"); L=page.evaluate("() => LIBRARY.length")
    check('nạp đủ bộ hạng mục chuẩn', n==L, f'{n}/{L}')
    check('tất cả để trống giá', page.evaluate("() => Store.list('catalog').every(c => !c.price)"))
    check('danh mục chia nhóm', page.evaluate("() => document.querySelectorAll('.grp-h').length")>=10)
    check('nạp lại không bị trùng', page.evaluate("() => addLibrary()")==0)
    page.screenshot(path=f'{OUT}/3-danh-muc.png')
    # nhập giá vài mục
    page.evaluate("""() => { const set=(n,p,c)=>{ const k=catByName(n); Store.put('catalog',{...k,price:p},0); if(c) setCatCost(k.id,c,0); };
      set('Tủ áo cánh mở',3200000,2000000); set('Giường ngủ 1m8',8500000,5500000); set('Tủ bếp dưới',4800000,3000000); }""")
    # báo giá A (chưa chốt) + đơn B (đã chốt)
    page.evaluate("""async () => {
      const mk = (name, rows) => { const q = newQuote(); q.customer={name,phone:'',address:''}; q.rows = rows.map(([n,qty]) => { const k=catByName(n); return newRow({name:k.name,material:k.material,unit:k.unit,price:k.price,qty,kid:k.id,kp:k.price}); }); const o=createOrderFrom(q); Store.put('orders',o,0); return o; };
      const A = mk('Khách A', [['Tủ áo cánh mở',4],['Giường ngủ 1m8',1]]);
      const B = mk('Khách B', [['Tủ áo cánh mở',5],['Tủ bếp dưới',3]]);
      for (const r of B.draft.rows) saveCostDoc(B.id,{rows:{[r.id]:catCost(rowCat(r).id)},kc:{[r.id]:catCost(rowCat(r).id)}},0);
      S.orderId=B.id; await doClose(B, today(), 0, 'transfer', null, '');
      const C = mk('Khách C giá riêng', [['Giường ngủ 1m8',1]]); C.draft.rows[0].price = 8000000; touchOrder(C,0);
      window.__ids={A:A.id,B:B.id,C:C.id}; }""")
    ids=page.evaluate("() => window.__ids")
    check('chưa đổi giá: không đơn nào bị báo giá cũ', page.evaluate("() => staleOrders().length")==0)
    check('giá tự sửa riêng cho khách không bị coi là giá cũ', page.evaluate(f"() => staleRows(Store.get('orders','{ids['C']}')).length")==0)
    # đổi giá hàng loạt: MDF +5%
    page.evaluate("() => { S.tab='catalog'; S.catGroup=''; render(); }")
    page.click('[data-act=bulk-price]'); page.wait_for_selector('#bp-kw')
    page.fill('#bp-kw','Melamine'); page.fill('#bp-pct','5')
    prev=page.inner_text('#bp-prev')
    page.screenshot(path=f'{OUT}/4-doi-gia.png')
    page.click('.sheet [data-sa=ok]'); page.wait_for_timeout(700)
    check('xem trước số hạng mục khớp', 'khớp' in prev, prev)
    np=page.evaluate("() => ({tu: catByName('Tủ áo cánh mở').price, bep: catByName('Tủ bếp dưới').price, tucost: catCost(catByName('Tủ áo cánh mở').id), giuong: catByName('Giường ngủ 1m8').price})")
    check('tăng 5% giá bán, làm tròn nghìn', np['tu']==3360000 and np['giuong']==8925000, np)
    check('tủ bếp (Acrylic) không bị đổi khi lọc Melamine', np['bep']==4800000, np)
    check('giá nhập cũng tăng 5%', np['tucost']==2100000, np)
    check('tự mở danh sách báo giá dùng giá cũ', page.query_selector('.sheet h3') is not None and 'giá cũ' in page.inner_text('.sheet h3'))
    page.screenshot(path=f'{OUT}/5-ds-gia-cu.png')
    st=page.evaluate("() => staleOrders().map(o=>o.id)")
    check('A (chưa chốt) và B (đã chốt) bị báo giá cũ', ids['A'] in st and ids['B'] in st, st)
    check('C (giá riêng) chỉ báo khi danh mục đổi sau đó', ids['C'] in st)
    page.keyboard.press('Escape')
    # cập nhật A: sửa thẳng bản nháp
    page.evaluate(f"() => openOrder('{ids['A']}')"); page.wait_for_selector('[data-act=reprice]')
    page.click('[data-act=reprice]'); page.wait_for_selector('[data-rp]')
    page.screenshot(path=f'{OUT}/6-cap-nhat.png')
    page.click('.sheet [data-sa=ok]'); page.wait_for_timeout(300)
    A=page.evaluate(f"() => {{ const o=Store.get('orders','{ids['A']}'); return {{ prices:o.draft.rows.map(r=>r.price), v:o.versions.length, stale: staleRows(o).length }}; }}")
    check('báo giá chưa chốt: cập nhật thẳng giá mới', A['prices']==[3360000,8925000] and A['v']==0 and A['stale']==0, A)
    # cập nhật B: đơn đã chốt → tạo bản 2, bản 1 giữ nguyên
    page.evaluate(f"() => {{ S.view='detail'; S.orderId='{ids['B']}'; render(); }}"); page.wait_for_selector('[data-act=reprice]')
    page.click('[data-act=reprice]'); page.wait_for_selector('[data-rp]')
    page.click('.sheet [data-sa=ok]'); page.wait_for_timeout(300)
    B=page.evaluate(f"() => {{ const o=Store.get('orders','{ids['B']}'); const p=profitOf(o, o.draft); return {{ v1: o.versions[0].quote.rows.map(r=>r.price), v1tot:o.versions[0].total, draft: o.draft && o.draft.rows.map(r=>r.price), status:o.status, goods:p.goods, view:S.view, total: orderTotal(o) }}; }}")
    check('đơn đã chốt: bản 1 khách ký giữ nguyên giá cũ', B['v1']==[3200000,4800000] and B['v1tot']==16000000+14400000, B)
    check('đơn đã chốt: tạo bản 2 với giá mới, mở để gửi khách', B['draft']==[3360000,4800000] and B['view']=='edit', B)
    check('tổng đơn chưa đổi cho đến khi chốt bản 2', B['total']==30400000, B['total'])
    check('bản 2 mang theo giá nhập mới', B['goods']==5*2100000+3*3000000, B['goods'])
    check('lịch sử ghi lại việc cập nhật giá', page.evaluate(f"() => Store.get('orders','{ids['B']}').log.some(l=>/giá mới/.test(l.text))"))
    check('không lỗi JS', not errs, errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
