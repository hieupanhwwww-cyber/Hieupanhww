import base64, os, sys, threading, http.server, functools, struct
import numpy as np, cv2
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out3'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8773),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
def last(page, prefix):
    page.wait_for_function(f"() => (window.__downloads||[]).some(d => d.filename.startsWith('{prefix}'))", timeout=20000)
    d=page.evaluate(f"() => window.__downloads.filter(d => d.filename.startsWith('{prefix}')).at(-1)")
    fp=f"{OUT}/{d['filename']}"; data=base64.b64decode(d['b64']); open(fp,'wb').write(data); return fp, d['filename'], data
def pngsize(data): return struct.unpack('>II', data[16:24])
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8773/test/local.html'); page.wait_for_selector('[data-act=seed-demo]')
    page.click('[data-act=seed-demo]'); page.evaluate("() => { S.tab='orders'; render(); }"); page.wait_for_timeout(300)
    page.evaluate("() => saveSettings({bankBin:'970436', bankAccount:'0011001234567', bankHolder:'NGUYEN VAN HIEU'})")
    # quote PNG from editor (draft, with QR)
    page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='quote').id)"); page.wait_for_selector('.ed-actions [data-act=png]')
    page.screenshot(path=f'{OUT}/editor-bar.png', clip={'x':0,'y':0,'width':1180,'height':80})
    page.click('.ed-actions [data-act=png]')
    fp,fn,data=last(page,'Bao-gia')
    w,h=pngsize(data)
    check('quote PNG file', fn.endswith('.png') and data[:8]==b'\x89PNG\r\n\x1a\n', fn)
    check('quote PNG: page1 full + trimmed last page', w==1240 and 1754<h<2400, (w,h))
    img=cv2.imread(fp, cv2.IMREAD_GRAYSCALE)[900:1300, 850:1240]; t=cv2.QRCodeDetector().detectAndDecode(img)[0]
    check('QR readable from quote PNG', t.startswith('000201') and 'D1' in t, t[:60])
    # multi-page: add many rows
    page.evaluate("""() => { const o=curOrder(); for (let i=0;i<40;i++) o.draft.rows.push(newRow({name:'Hạng mục thử '+(i+1), material:'MDF chống ẩm', unit:'cái', qty:1, price:100000})); touchOrder(o,0); render(); }""")
    page.click('.ed-actions [data-act=preview]'); page.wait_for_selector('#pv img'); page.wait_for_timeout(300)
    page.click('.sheet-f [data-sa=png]')
    page.wait_for_function("() => window.__downloads.filter(d => d.filename.startsWith('Bao-gia')).length>=2", timeout=20000)
    d=page.evaluate("() => window.__downloads.filter(d => d.filename.startsWith('Bao-gia')).at(-1)")
    data=base64.b64decode(d['b64']); open(f"{OUT}/long.png",'wb').write(data); w,h=pngsize(data)
    check('multi-page quote → one long PNG', w==1240 and h>3400, (w,h, round(len(data)/1e6,2),'MB'))
    page.click('.sheet-h [data-sa=close]')
    # receipt PNG via menu
    page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='building').id)"); page.wait_for_selector('[data-act=receipt]')
    page.click('[data-act=receipt] >> nth=0'); page.click('.menu-list button:has-text("ảnh PNG")')
    fp,fn,data=last(page,'Phieu-thu'); w,h=pngsize(data)
    check('receipt PNG one image', fn.endswith('.png') and w==1240 and 500<h<890, (fn,w,h))
    # pay request PNG
    page.click('[data-act=plan-qr] >> nth=0'); page.wait_for_selector('.qrimg')
    page.click('.sheet-f [data-sa=png]')
    fp,fn,data=last(page,'De-nghi')
    img=cv2.imread(fp, cv2.IMREAD_GRAYSCALE); t=cv2.QRCodeDetector().detectAndDecode(img)[0]
    check('pay request PNG + QR readable', fn.endswith('.png') and t.startswith('000201'), fn)
    page.click('.sheet-f [data-sa=close]')
    # handover PNG
    page.evaluate("() => openOrder(Store.list('orders').find(o=>o.handover).id)"); page.wait_for_selector('[data-act=handover-png]')
    page.click('[data-act=handover-png]')
    fp,fn,data=last(page,'Bien-ban')
    check('handover PNG', fn.endswith('.png') and data[:4]==b'\x89PNG', fn)
    # portrait editor bar
    page.set_viewport_size({'width':820,'height':1180})
    page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='quote').id)"); page.wait_for_selector('.ed-bar [data-act=png]')
    page.screenshot(path=f'{OUT}/portrait-bar.png', clip={'x':0,'y':1080,'width':820,'height':100})
    page.set_viewport_size({'width':390,'height':844}); page.wait_for_timeout(150)
    ov=page.evaluate("() => { const b=document.querySelector('.ed-bar'); return b.scrollWidth > b.clientWidth + 1 }")
    check('phone editor bar fits', not ov)
    page.screenshot(path=f'{OUT}/phone-bar.png', clip={'x':0,'y':760,'width':390,'height':84})
    check('no JS errors', not errs, errs[:3])
    b.close()
srv.shutdown(); print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)
