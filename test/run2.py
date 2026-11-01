import base64, json, os, subprocess, sys, threading, http.server, functools
import numpy as np, cv2
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out2'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8771),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
URL='http://127.0.0.1:8771/test/local.html'
MOCK=open(ROOT+'/test/mock.js').read()
res=[]
def check(n,c,x=''):
    res.append((n,bool(c))); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
def sign(page, sel):
    bb=page.locator(sel).bounding_box()
    x,y,w,h=bb['x'],bb['y'],bb['width'],bb['height']
    page.mouse.move(x+w*0.15,y+h*0.6); page.mouse.down()
    for i in range(1,25):
        page.mouse.move(x+w*(0.15+0.03*i), y+h*(0.6-0.25*((i%4)/3)), steps=2)
    page.mouse.up()
def save_dl(page, prefix):
    d=page.evaluate('() => window.__downloads.at(-1)')
    fp=f"{OUT}/{d['filename']}"; open(fp,'wb').write(base64.b64decode(d['b64'])); return fp, d['filename']
def decode_canvas(page, sel):
    b64=page.evaluate(f"() => document.querySelector('{sel}').toDataURL('image/png').split(',')[1]")
    img=cv2.imdecode(np.frombuffer(base64.b64decode(b64),np.uint8), cv2.IMREAD_GRAYSCALE)
    return cv2.QRCodeDetector().detectAndDecode(img)[0]
def crc(s):
    c=0xFFFF
    for ch in s.encode():
        c^=ch<<8
        for _ in range(8): c=((c<<1)^0x1021)&0xFFFF if c&0x8000 else (c<<1)&0xFFFF
    return '%04X'%c
errors=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1180,'height':820}, has_touch=True, locale='vi-VN', timezone_id='Asia/Bangkok')
    ctx.add_init_script(MOCK); ctx.route('**fonts.g*',lambda r:r.abort())
    page=ctx.new_page()
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL); page.wait_for_selector('[data-act=seed-demo]')
    page.click('[data-act=seed-demo]'); page.evaluate("() => { S.tab='orders'; render(); }"); page.wait_for_timeout(300)

    # ---------- settings: bank ----------
    page.click('.rail [data-tab=settings]'); page.wait_for_selector('#st-bankBin')
    check('qr not ready before bank', 'Chưa đủ' in page.inner_text('#qrtest'))
    page.select_option('#st-bankBin','970436')
    page.fill('#st-bankAccount','0011001234567'); page.fill('#st-bankHolder','NGUYEN VAN HIEU')
    page.wait_for_timeout(700)
    check('qr ready after bank', 'Đã sẵn sàng' in page.inner_text('#qrtest'), page.inner_text('#qrtest'))
    page.click('[data-act=qr-test]'); page.wait_for_selector('.qrimg')
    t=decode_canvas(page,'.qrimg')
    check('test QR decodes as VietQR', t.startswith('000201010212') and '970436' in t and '0011001234567' in t and '540510000' in t and crc(t[:-4])==t[-4:], t)
    page.click('.sheet-f [data-sa=close]')
    # plan template edit
    page.screenshot(path=f'{OUT}/01-settings.png', full_page=False)
    tpl_rows=page.locator('#tpl-card .prow').count()
    check('template editor shows 3 rows', tpl_rows==3, tpl_rows)

    # ---------- demo: plan states ----------
    st=page.evaluate("""() => Store.list('orders').filter(o=>o.plan&&o.plan.length).map(o=>({n:headQuote(o).customer.name, rows: planStatus(o).map(r=>[r.n,r.amount,r.paid,r.left,r.state])}))""")
    print(json.dumps(st, ensure_ascii=False))
    lan=[x for x in st if x['n'].startswith('Chị Lan')][0]['rows']
    check('Lan plan: sum = total 44.4M', sum(r[1] for r in lan)==44400000, lan)
    check('Lan đợt1 paid, đợt2 overdue partial', lan[0][4]=='paid' and lan[1][4]=='overdue' and lan[1][2]==31000000-lan[0][1], lan)
    check('Lan đợt3 later', lan[2][4]=='later', lan)
    tuan=[x for x in st if x['n'].startswith('Anh Tuấn')][0]['rows']
    check('Tuấn đợt1 due partial', tuan[0][4]=='due' and tuan[0][2]==10000000, tuan)

    # list banner + filter
    page.click('.rail [data-tab=today]'); page.wait_for_timeout(200)
    check('overdue shown on Today', 'quá hạn' in page.inner_text('.main') and 'Chị Lan' in page.inner_text('.todos'))
    page.click('.rail [data-f=collect]'); page.wait_for_timeout(150)
    names=page.locator('.ocard .oc-name').all_inner_texts()
    check('collect filter shows Lan + Tuấn', sorted(names)==sorted(['Chị Lan (mẫu)','Anh Tuấn (mẫu)']), names)
    page.screenshot(path=f'{OUT}/02-list.png')

    # ---------- new quote with plan, sign at close ----------
    page.click('.rail [data-f=all]')
    page.click('.list-head [data-act=new-quote]'); page.wait_for_selector('#plan-card .prow')
    check('new quote has default plan', page.locator('#plan-card .prow').count()==3)
    page.fill('#qf-name','Chị Thu Thử'); page.fill('#qf-phone','0988 111 222'); page.fill('#qf-project','Phòng ngủ – Hà Đông')
    page.click('[data-act=add-row]')
    rid=page.evaluate("() => curOrder().draft.rows.at(-1).id")
    page.fill(f'#n-{rid}','Tủ áo kịch trần'); page.fill(f'#q-{rid}','10'); page.type(f'#p-{rid}','3000000')
    page.wait_for_timeout(150)
    amts=page.locator('#plan-card [data-pamt]').all_inner_texts()
    check('plan amounts in editor 15tr/12tr/3tr', amts==['15.000.000','12.000.000','3.000.000'], amts)
    # change pct of row 1 to 30 → 9tr, 12tr, 9tr
    p1=page.evaluate("() => curOrder().draft.plan[0].id")
    page.fill(f'#pp-{p1}','30'); page.wait_for_timeout(100)
    amts=page.locator('#plan-card [data-pamt]').all_inner_texts()
    check('editing pct updates amounts', amts==['9.000.000','12.000.000','9.000.000'], amts)
    # add a row
    page.click('#plan-card [data-act=plan-add]'); page.wait_for_timeout(100)
    check('plan add row', page.locator('#plan-card .prow').count()==4)
    pnew=page.evaluate("() => curOrder().draft.plan[2].id")
    page.fill(f'#pp-{pnew}','10'); page.fill(f'#pl-{pnew}','Khi giao hàng'); page.wait_for_timeout(100)
    amts=page.locator('#plan-card [data-pamt]').all_inner_texts()
    check('4-row plan amounts', amts==['9.000.000','12.000.000','3.000.000','6.000.000'], amts)
    page.screenshot(path=f'{OUT}/03-editor-plan.png', full_page=False)
    page.locator('#plan-card').scroll_into_view_if_needed(); page.screenshot(path=f'{OUT}/03b-editor-plan.png')
    # PDF of draft has QR of đợt 1
    page.click('.ed-actions [data-act=pdf]')
    page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('Bao-gia'))", timeout=15000)
    fp,fn=save_dl(page,'q'); subprocess.run(['pdftoppm','-r','150','-png',fp,f'{OUT}/quote'])
    img=cv2.imread(f'{OUT}/quote-1.png', cv2.IMREAD_GRAYSCALE)
    t=cv2.QRCodeDetector().detectAndDecode(img)[0]
    check('quote PDF QR decodes with đợt 1 amount', '54079000000' in t and 'D1' in t, t)
    # close with signature + deposit
    page.click('.ed-actions [data-act=close-quote]'); page.wait_for_selector('#cl-sig')
    page.click('[data-sa=dep-first]')
    check('deposit = đợt 1', page.input_value('#cl-dep')=='9.000.000', page.input_value('#cl-dep'))
    page.click('#cl-method [data-v=cash]')
    page.wait_for_timeout(300)
    page.locator('#cl-sig').scroll_into_view_if_needed()
    sign(page,'#cl-sig')
    page.screenshot(path=f'{OUT}/04-close-sign.png')
    page.click('.sheet-f [data-sa=ok]'); page.wait_for_selector('.bignums'); page.wait_for_timeout(300)
    o=page.evaluate("() => { const o=curOrder(); const v=o.versions[0]; return {sign: !!v.sign, hash: v.sign&&v.sign.hash, img: v.sign&&v.sign.img.length, pay: o.payments[0], plan: planStatus(o).map(r=>[r.amount,r.state])} }")
    check('version signed with hash', o['sign'] and len(o['hash'])==16 and 500 < o['img'] < 60000, o)
    check('deposit payment cash no=1', o['pay']['method']=='cash' and o['pay']['no']==1 and o['pay']['amount']==9000000, o['pay'])
    check('plan after close', o['plan']==[[9000000,'paid'],[12000000,'later'],[3000000,'later'],[6000000,'later']], o['plan'])
    page.screenshot(path=f'{OUT}/05-detail.png')
    # signed PDF
    page.click('[data-act=pdf][data-src="1"]')
    page.wait_for_function("() => (window.__downloads||[]).filter(d => d.filename.startsWith('Bao-gia')).length >= 2", timeout=15000)
    fp,fn=save_dl(page,'q2'); subprocess.run(['pdftoppm','-r','70','-png',fp,f'{OUT}/signed'])
    # status → building makes đợt 2 due
    page.click('[data-act=set-status][data-s=building]'); page.wait_for_timeout(150)
    stt=page.evaluate("() => planStatus(curOrder()).map(r=>r.state)")
    check('building → đợt 2 due', stt[1]=='due', stt)
    # set due date in past → overdue
    pid=page.evaluate("() => curOrder().plan[1].id")
    page.evaluate(f"() => {{ const i=document.querySelector('[data-due=\"{pid}\"]'); i.value='2026-10-01'; i.dispatchEvent(new Event('change',{{bubbles:true}})); }}")
    page.wait_for_timeout(150)
    stt=page.evaluate("() => planStatus(curOrder()).map(r=>r.state)")
    check('past due date → overdue', stt[1]=='overdue', stt)
    # QR for đợt 2
    page.click('[data-act=plan-qr][data-n="2"]'); page.wait_for_selector('.qrimg')
    t=decode_canvas(page,'.qrimg')
    check('đợt 2 QR amount+memo', '540812000000' in t and 'D2' in t and crc(t[:-4])==t[-4:], t)
    page.screenshot(path=f'{OUT}/06-qr.png')
    page.click('.sheet-f [data-sa=pdf]')
    page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('De-nghi'))", timeout=15000)
    fp,fn=save_dl(page,'pr'); info=subprocess.run(['pdfinfo',fp],capture_output=True,text=True).stdout
    check('pay request PDF A5 landscape', '595.28 x 420.94' in info or 'A5' in info, info.split('Page size:')[1].split('\n')[0] if 'Page size' in info else info)
    subprocess.run(['pdftoppm','-r','100','-png',fp,f'{OUT}/payreq'])
    page.click('.sheet-f [data-sa=close]')
    # pay đợt 2 via Thu button
    page.click('[data-act=plan-pay][data-n="2"]'); page.wait_for_selector('#pay-amt')
    check('pay preset = đợt 2', page.input_value('#pay-amt')=='12.000.000', page.input_value('#pay-amt'))
    page.click('.sheet-f [data-sa=save]'); page.wait_for_selector('.sheet-f [data-sa=rc]')
    page.click('.sheet-f [data-sa=rc]')
    page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('Phieu-thu'))", timeout=15000)
    fp,fn=save_dl(page,'rc'); info=subprocess.run(['pdfinfo',fp],capture_output=True,text=True).stdout
    check('receipt PDF ok', 'Pages:           1' in info and fn.endswith('-02.pdf'), fn)
    subprocess.run(['pdftoppm','-r','100','-png',fp,f'{OUT}/receipt'])
    stt=page.evaluate("() => planStatus(curOrder()).map(r=>r.state)")
    check('đợt 2 paid', stt[1]=='paid', stt)
    # change order with signature
    page.click('.d-actions [data-act=add-change]'); page.wait_for_selector('#chg-title')
    page.fill('#chg-title','Thêm gương soi'); page.type('#chg-amt','1500000'); page.fill('#chg-note','Khách yêu cầu khi lắp')
    page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    page.click('[data-act=confirm-change]'); page.wait_for_selector('#cf-sig')
    page.wait_for_timeout(300); page.locator('#cf-sig').scroll_into_view_if_needed(); sign(page,'#cf-sig')
    page.click('.sheet-f [data-sa=ok]'); page.wait_for_timeout(400)
    c=page.evaluate("() => { const o=curOrder(); const c=o.changes.at(-1); return {st:c.status, s:!!c.custSign, last: planStatus(o).at(-1).amount} }")
    check('change confirmed with signature, last đợt absorbs', c['st']=='confirmed' and c['s'] and c['last']==7500000, c)
    # change with zalo proof image
    page.click('.d-actions [data-act=add-change]'); page.wait_for_selector('#chg-title')
    page.fill('#chg-title','Bớt đèn LED'); page.click('#chg-sign [data-v="-1"]'); page.type('#chg-amt','500000')
    page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    page.click('[data-act=confirm-change]'); page.wait_for_selector('#cf-proof', state='attached')
    import struct, zlib
    def png(w,h):
        raw=b''.join(b'\x00'+bytes([90,160,220])*w for _ in range(h))
        ch=lambda t,d: struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
        return b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw))+ch(b'IEND',b'')
    open(f'{OUT}/zalo.png','wb').write(png(40,60))
    page.set_input_files('#cf-proof', f'{OUT}/zalo.png'); page.wait_for_timeout(100)
    page.click('.sheet-f [data-sa=ok]'); page.wait_for_timeout(600)
    c=page.evaluate("() => { const o=curOrder(); const c=o.changes.at(-1); return {st:c.status, proof:c.proofId, att:o.attachments.some(a=>a.id===c.proofId)} }")
    check('change confirmed with Zalo proof', c['st']=='confirmed' and c['proof'] and c['att'], c)
    # handover with signature
    page.click('.d-actions [data-act=handover]'); page.wait_for_selector('#hv-sig')
    check('warranty default 36', page.input_value('#hv-months')=='36')
    page.wait_for_timeout(300); page.locator('#hv-sig').scroll_into_view_if_needed(); sign(page,'#hv-sig')
    page.click('.sheet-f [data-sa=ok]')
    page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('Bien-ban'))", timeout=15000)
    fp,fn=save_dl(page,'hv'); subprocess.run(['pdftoppm','-r','70','-png',fp,f'{OUT}/handover'])
    h=page.evaluate("() => { const o=curOrder(); return {st:o.status, h:o.handover, plan: planStatus(o).map(r=>r.state)} }")
    check('handover saved, done, warranty +36m', h['st']=='done' and h['h']['warrantyUntil']==str(int(h['h']['date'][:4])+3)+h['h']['date'][4:] and h['h']['sign'] is not None, {k:h['h'][k] for k in ['date','warrantyUntil']})
    check('accept trigger → last đợt due', h['plan'][-1]=='due', h['plan'])
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/07-detail-after.png', full_page=False)
    # ---------- sign later on existing version ----------
    page.evaluate("() => { const o=Store.list('orders').find(o=>o.code.endsWith('M1') && o.status==='closed'); openOrder(o.id); }")
    page.wait_for_selector('[data-act=sign-version]')
    page.click('[data-act=sign-version]'); page.wait_for_selector('#sv-sig'); page.wait_for_timeout(300)
    sign(page,'#sv-sig'); page.click('.sheet-f [data-sa=ok]'); page.wait_for_timeout(300)
    check('sign later on version', page.evaluate("() => !!lastVersion(curOrder()).sign"))

    # ---------- offline outbox ----------
    oid=page.evaluate("() => Store.list('orders').find(o=>o.status==='quote').id")
    page.evaluate(f"() => {{ window.__failWrites = true; openOrder('{oid}'); }}")
    page.wait_for_selector('#qf-project')
    page.fill('#qf-project','Sửa khi mất mạng'); page.wait_for_timeout(2600)
    stt=page.inner_text('.ed-top [data-savestat]')
    check('offline status text', 'Chưa có mạng' in stt, stt)
    page.screenshot(path=f'{OUT}/08-offline.png')
    page.evaluate("() => localStorage.removeItem('snt-view')"); page.reload(); page.wait_for_selector('.list-head'); page.wait_for_timeout(1500)
    got=page.evaluate(f"() => Store.get('orders','{oid}').draft.project")
    check('outbox restored after reload', got=='Sửa khi mất mạng', got)
    srv_side=page.evaluate(f"() => JSON.parse(sessionStorage.getItem('__mockdb'))['orders/{oid}'].draft.project")
    check('restored change written to server', srv_side=='Sửa khi mất mạng', srv_side)
    # backup reminder
    page.evaluate("() => { S.tab='today'; render(); }")
    check('backup reminder shown', 'chưa sao lưu' in page.inner_text('.main').lower())
    page.click('.main [data-act=backup]'); page.wait_for_timeout(500)
    check('backup reminder cleared', 'chưa sao lưu' not in page.inner_text('.todos').lower())
    # portrait checks
    page.set_viewport_size({'width':820,'height':1180})
    page.evaluate("() => { const o=Store.list('orders').find(o=>o.status==='building'); openOrder(o.id); }"); page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/09-detail-portrait.png')
    ov=page.evaluate('() => [...document.querySelectorAll(".pane")].some(p => p.scrollWidth > p.clientWidth + 1)')
    check('no overflow portrait detail', not ov)
    page.evaluate("() => { const o=Store.list('orders').find(o=>o.status==='quote'); openOrder(o.id); }"); page.wait_for_selector('#plan-card')
    page.locator('#plan-card').scroll_into_view_if_needed(); page.screenshot(path=f'{OUT}/10-editor-plan-portrait.png')
    ov=page.evaluate('() => [...document.querySelectorAll(".pane")].some(p => p.scrollWidth > p.clientWidth + 1)')
    check('no overflow portrait editor', not ov)
    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(200)
    ov=page.evaluate('() => [...document.querySelectorAll(".pane")].some(p => p.scrollWidth > p.clientWidth + 1)')
    check('no overflow phone editor', not ov)
    page.locator('#plan-card').scroll_into_view_if_needed(); page.screenshot(path=f'{OUT}/11-phone-plan.png')
    page.emulate_media(color_scheme='dark'); page.set_viewport_size({'width':1180,'height':820})
    page.evaluate("() => { const o=Store.list('orders').find(o=>o.versions.some(v=>v.sign)); openOrder(o.id); }"); page.wait_for_timeout(200)
    page.screenshot(path=f'{OUT}/12-dark.png')
    check('no JS errors', not errors, errors[:5])
    b.close()
srv.shutdown()
f=[r for r in res if not r[1]]; print(f'\n{len(res)-len(f)}/{len(res)} passed'); sys.exit(1 if f else 0)
