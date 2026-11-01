# Kiểm thử tính lãi: giá nhập + vận chuyển
import os, threading, http.server, functools, json
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8777),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8777/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    # 1. danh mục có giá nhập → thêm vào báo giá tự có giá nhập
    page.evaluate("""() => { Store.put('catalog', { id: 'k1', name: 'Tủ áo', material: 'MDF', unit: 'm²', price: 3000000 }, 0); setCatCost('k1', 2000000, 0);
                             Store.put('catalog', { id: 'k2', name: 'Giường', material: 'MDF', unit: 'bộ', price: 8000000 }, 0); }""")
    page.click('[data-act=new-quote]'); page.wait_for_selector('#qf-name')
    page.fill('#qf-name','Khách thử lãi')
    page.click('[data-act=add-from-cat]'); page.wait_for_selector('.pick')
    page.click('.pick[data-id=k1]'); page.click('.pick[data-id=k2]'); page.click('.sheet [data-sa=close]')
    page.evaluate("""() => { const o = curOrder(); o.draft.rows[0].qty = 5; refreshRows(o); touchOrder(o, 0); }""")
    r=page.evaluate("() => { const p = profitOf(curOrder()); return p; }")
    check('dòng thêm từ danh mục tự có giá nhập', r['goods']==10000000, r)
    check('dòng chưa có giá nhập được báo thiếu', r['missing']==1)
    txt=page.inner_text('#profit-card')
    check('báo giá hiện thẻ Lãi dự kiến', 'Lãi dự kiến' in txt and 'Không in ra báo giá'.upper() in txt.upper())
    # 2. nhập giá nhập + vận chuyển qua bảng
    page.click('#profit-card [data-act=profit-edit]'); page.wait_for_selector('[data-cost]')
    inputs=page.query_selector_all('[data-cost]')
    inputs[1].fill('5.500.000'); page.fill('#cost-ship','700.000')
    sumtxt=page.inner_text('#cost-sum')
    page.click('.sheet [data-sa=save]'); page.wait_for_timeout(300)
    r=page.evaluate("() => profitOf(curOrder())")
    # doanh thu = 5*3tr + 8tr = 23tr ; chi phí = 10tr + 5.5tr + 0.7tr = 16.2tr ; lãi 6.8tr
    check('lãi = doanh thu − giá nhập − vận chuyển', r['rev']==23000000 and r['cost']==16200000 and r['profit']==6800000, r)
    check('% lãi đúng', abs(r['pct']-6800000/23000000*100)<0.01, round(r['pct'],2))
    check('bảng nhập tính tổng ngay khi gõ', '6.800.000' in sumtxt, sumtxt.replace('\n',' '))
    check('lưu giá nhập vào danh mục', page.evaluate("() => catCost('k2')")==5500000)
    # 3. giá nhập không lọt vào báo giá PDF
    page.evaluate("() => { window.__txt=[]; const f=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(t,...a){ window.__txt.push(String(t)); return f.call(this,t,...a); }; }")
    page.evaluate("async () => { await renderQuotePages(curOrder(), 'draft'); }")
    alltxt=' | '.join(page.evaluate("() => window.__txt"))
    check('PDF/PNG không có giá nhập, vận chuyển nội bộ, lãi', '2.000.000' not in alltxt and '5.500.000' not in alltxt and 'Lãi' not in alltxt and '700.000' not in alltxt)
    # 4. chốt đơn: đổi giá danh mục sau đó không làm đổi lãi đơn đã chốt
    page.evaluate("async () => { const o = curOrder(); await doClose(o, today(), 0, 'transfer', null, ''); }"); page.wait_for_timeout(200)
    before=page.evaluate("() => profitOf(curOrder()).profit")
    page.evaluate("() => setCatCost('k1', 2900000, 0)")
    after=page.evaluate("() => profitOf(curOrder()).profit")
    check('đổi giá nhập trong danh mục không đổi lãi đơn đã chốt', before==after==6800000, (before,after))
    # 5. sửa báo giá (bản mới) mang theo giá nhập
    page.evaluate("() => ACTIONS.revise()"); page.wait_for_timeout(200)
    r=page.evaluate("() => { const o = curOrder(); return profitOf(o, o.draft); }")
    check('bản sửa mới giữ nguyên giá nhập', r['goods']==15500000 and r['ship']==700000, r)
    page.evaluate("() => { S.view='detail'; const o = curOrder(); o.draft = null; touchOrder(o,0); render(); }")
    # 6. phát sinh có chi phí
    page.evaluate("""() => { const o = curOrder(); o.changes.push({ id: 'g1', sign: 1, title: 'Kệ', amount: 2000000, status: 'confirmed', confirmedAt: today(), createdAt: new Date().toISOString() }); touchOrder(o,0); saveCostDoc(o.id, { chg: { g1: 1200000 } }, 0); }""")
    r=page.evaluate("() => profitOf(curOrder())")
    check('phát sinh: cộng doanh thu, trừ chi phí phát sinh', r['rev']==25000000 and r['profit']==7600000, r)
    # 7. thống kê
    page.evaluate("() => { S.tab='stats'; S.period='month'; render(); }")
    kt=page.inner_text('.kpi-profit')
    check('thống kê có ô Lãi ước tính', '7.600.000' in kt, kt.replace('\n',' '))
    # 8. sao lưu có giá nhập; khôi phục lại đúng
    data=page.evaluate("() => { const d = {}; for (const c of COLS) d[c] = Store.list(c); return d; }")
    check('sao lưu gồm giá nhập', any(x['id'].startswith('o_') for x in data['costs']) and any(x['id']=='k_k1' for x in data['costs']))
    # 9. danh mục có cột giá nhập
    page.evaluate("() => { S.tab='catalog'; render(); }")
    check('danh mục có cột Giá nhập và % lãi', page.query_selector('#cc-k1') is not None and 'lãi' in page.inner_text('.cat-row[data-cat=k1]'))
    check('không lỗi JS', not errs, errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
