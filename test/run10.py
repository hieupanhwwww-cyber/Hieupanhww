# Kiểm thử: Sổ thu chi, Tùy chỉnh app
import os, threading, http.server, functools, base64, csv, io
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out10'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8783),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8783/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    # một đơn đã chốt, khách trả 20 triệu
    oid=page.evaluate("""async () => { const q=newQuote(); q.customer={name:'Khách thu chi',phone:'0912345678',address:''}; q.rows=[newRow({name:'Tủ áo cánh mở',unit:'m²',qty:10,price:3000000})];
      const o=createOrderFrom(q); Store.put('orders',o,0); S.orderId=o.id; await doClose(o, today(), 20000000, 'transfer', null, ''); return o.id; }""")
    # ---- ghi khoản chi từ Hôm nay ----
    page.evaluate("() => { S.tab='today'; render(); }")
    page.click('.list-head [data-act=cash-add][data-type=out]'); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','12.000.000'); page.click('#cs-cats [data-v="Vật tư, ván"]')
    page.select_option('#cs-oid', oid); page.fill('#cs-note','Ván MDF 17 ly')
    page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    page.evaluate(f"() => cashSheet('out', null, '{oid}')"); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','3.000.000'); page.click('#cs-cats [data-v="Nhân công, thợ"]'); page.click('#cs-method [data-v=cash]'); page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    page.evaluate("() => cashSheet('out')"); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','1.500.000'); page.click('#cs-cats [data-v="Quảng cáo"]'); page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    page.evaluate("() => cashSheet('in')"); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','500.000'); page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    s=page.evaluate("() => { const [a,b]=monthRange(); return cashSum(cashList(a,b)); }")
    check('tổng thu = tiền khách 20tr + thu khác 0,5tr', s['in']==20500000 and s['inCust']==20000000 and s['inOther']==500000, s)
    check('tổng chi 16,5tr, thu − chi 4tr', s['out']==16500000 and s['net']==4000000, s)
    check('chi theo nhóm: vật tư lớn nhất', s['cats'][0]['g']=='Vật tư, ván' and s['cats'][0]['v']==12000000, s['cats'])
    tile=page.inner_text('.tiles')
    check('Hôm nay: ô Lãi tháng này (thu − chi)', 'Lãi tháng này' in tile and '4 tr' in tile, tile.replace('\n',' '))
    # ---- màn Thu chi ----
    page.click('.rail [data-fin=cash]'); page.wait_for_selector('.crows')
    rows=page.locator('.crows .crow').count()
    check('sổ thu chi: 4 khoản ghi + 1 lần khách trả', rows==5, rows)
    hero=page.inner_text('.kpi.hero')
    check('ô Thu − Chi hiện 4.000.000 đ', '4.000.000' in hero, hero.replace('\n',' '))
    page.click('[data-act=cash-f][data-v=out]'); page.wait_for_timeout(100)
    check('lọc chỉ khoản chi', page.locator('.crows .crow').count()==3)
    page.click('[data-act=cash-f][data-v=all]'); page.wait_for_timeout(100)
    # sửa khoản quảng cáo → 2.000.000
    page.click('.crow:has-text("Quảng cáo")'); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','2.000.000'); page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    check('sửa khoản chi', page.evaluate("() => Store.list('cash').find(e=>e.cat==='Quảng cáo').amount")==2000000)
    # xóa khoản thu khác
    page.click('.crow:has-text("Thu khác")'); page.wait_for_selector('.sheet-f [data-sa=del]')
    page.click('.sheet-f [data-sa=del]'); page.click('.sheet-f [data-sa=yes]'); page.wait_for_timeout(200)
    check('xóa khoản thu', page.evaluate("() => Store.list('cash').filter(e=>e.type==='in').length")==0)
    # bấm dòng tiền khách → mở đơn
    page.click('.crow:has-text("Tiền khách trả")'); page.wait_for_timeout(200)
    check('chạm dòng tiền khách trả → mở đơn', page.evaluate("() => S.tab")=='orders' and page.evaluate("() => S.orderId")==oid)
    # ---- chi phí thực tế trong đơn ----
    t=page.inner_text('details[data-sect=ocash]')
    check('đơn: đã chi 15tr, lãi thực tế 15tr', '15.000.000' in t and 'Lãi thực tế' in t, t.replace('\n',' ')[:200])
    check('đơn: tiền đang giữ = đã thu − đã chi = 5tr', '5.000.000' in t)
    # ---- xuất Excel ----
    page.evaluate("() => { S.tab='stats'; S.fin='cash'; render(); }")
    page.click('[data-act=cash-csv]'); page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('Thu-chi'))", timeout=10000)
    d=page.evaluate("() => window.__downloads.filter(d => d.filename.startsWith('Thu-chi')).at(-1)")
    raw=base64.b64decode(d['b64']).decode('utf-8'); rows=list(csv.reader(io.StringIO(raw.lstrip('﻿'))))
    tot=[r for r in rows if len(r)>1 and r[1]=='TỔNG'][0]
    check('Excel thu chi: tổng thu, tổng chi đúng', int(tot[7])==20000000 and int(tot[8])==17000000, tot)
    check('Excel thu chi: có cột mã đơn cho khoản gắn đơn', any(r[4] and r[1]=='Chi' for r in rows[1:] if len(r)>4))
    # ---- tùy chỉnh app ----
    page.evaluate("() => { S.tab='settings'; render(); }"); page.wait_for_selector('[data-feat=today]')
    check('bản trong Claude: ẩn mục Làm việc nhóm không dùng được', 'Kết nối máy chủ chung' not in page.inner_text('.main'))
    page.click('label.feat:has([data-feat=cash])'); page.wait_for_timeout(150)
    check('tắt Sổ thu chi: mất mục Thu chi ở thanh bên', page.query_selector('.rail [data-fin=cash]') is None)
    page.click('label.feat:has([data-feat=profit])'); page.wait_for_timeout(150)
    page.evaluate(f"() => openOrder('{oid}')"); page.wait_for_timeout(150)
    check('tắt tính lãi + thu chi: chi tiết đơn không còn 2 phần đó', page.query_selector('#profit-card') is None and page.query_selector('details[data-sect=ocash]') is None)
    page.evaluate("() => { S.tab='settings'; render(); }")
    page.click('label.feat:has([data-feat=today])'); page.wait_for_timeout(150)
    check('tắt Hôm nay: mất mục ở thanh bên', page.query_selector('.rail [data-tab=today]') is None)
    tb=page.evaluate("() => { S.tab='today'; render(); return [S.tab, feat('today'), !!document.querySelector('.list-pane'), S.view]; }")
    check('tắt Hôm nay: mở app vào thẳng Đơn hàng', tb[0]=='orders' and tb[2], tb)
    page.evaluate("() => { S.tab='settings'; render(); }"); page.wait_for_selector('[data-feat=qrPdf]')
    page.evaluate("() => saveSettings({bankBin:'970436', bankAccount:'0011001234567', bankHolder:'NGUYEN VAN A'})")
    page.click('label.feat:has([data-feat=qrPdf])'); page.wait_for_timeout(150)
    page.evaluate("() => { window.__txt=[]; const f=CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText=function(t,...a){ window.__txt.push(String(t)); return f.call(this,t,...a); }; }")
    page.evaluate(f"async () => {{ await renderQuotePages(Store.get('orders','{oid}'), '1'); }}")
    check('tắt QR trên báo giá: PDF không còn mã QR', not any('Quét để chuyển khoản' in x for x in page.evaluate("() => window.__txt")))
    page.fill('#st-followDays','0'); page.wait_for_timeout(700)
    check('nhắc gọi lại = 0 được lưu', str(page.evaluate("() => settings().followDays"))=='0')
    page.click('[data-act=theme][data-v=dark]'); page.wait_for_timeout(100)
    check('giao diện Tối', page.evaluate("() => document.documentElement.dataset.theme")=='dark')
    page.click('[data-act=theme][data-v=auto]'); page.wait_for_timeout(100)
    check('giao diện Tự động', page.evaluate("() => document.documentElement.dataset.theme") is None)
    check('không lỗi JS', not errs, errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
