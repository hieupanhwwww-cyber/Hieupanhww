# Ảnh chụp giao diện mới
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out9'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8779),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
def setup(page):
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8779/test/local.html'); page.wait_for_selector('[data-act=seed-demo]')
    page.screenshot(path=f'{OUT}/{page.__n}-0-trong.png')
    page.click('[data-act=seed-demo]'); page.wait_for_timeout(300)
    page.evaluate("() => { saveSettings({bankBin:'970436', bankAccount:'0011001234567', bankHolder:'NGUYEN VAN HIEU'}); document.querySelector('.toasts')?.remove(); render(); }")
with sync_playwright() as p:
    b=p.chromium.launch()
    for name, vp, scheme in [('ipad', {'width':1180,'height':820}, 'light'), ('dark', {'width':1180,'height':820}, 'dark'), ('phone', {'width':390,'height':844}, 'light')]:
        page=b.new_page(viewport=vp, color_scheme=scheme); page.__n=name; setup(page)
        page.wait_for_timeout(200); page.screenshot(path=f'{OUT}/{name}-1-homnay.png')
        if name=='dark': page.close(); continue
        page.evaluate("() => { S.tab='orders'; S.filter='all'; render(); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-2-don.png')
        page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='building').id)"); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/{name}-3-chi-tiet.png')
        page.evaluate("() => { const p = document.querySelector('[data-pane^=detail]'); p && (p.scrollTop = 9999); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-3b-chi-tiet-duoi.png')
        page.evaluate("() => { S.tab='stats'; render(); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-4-doanh-thu.png')
        page.evaluate("() => { document.querySelector('[data-pane=stats]').scrollTop=9999; }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-4b-doanh-thu-duoi.png')
        page.evaluate("() => openPalette()"); page.wait_for_timeout(200)
        page.keyboard.type('lan'); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/{name}-5-tim-nhanh.png')
        page.keyboard.press('Escape')
        page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='quote').id)"); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/{name}-6-bao-gia.png')
        page.evaluate("() => { const p = document.querySelector('.ed-scroll'); p && (p.scrollTop = 9999); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-6b-bao-gia-duoi.png')
        page.evaluate("() => { S.view='detail'; S.tab='settings'; render(); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-7-cai-dat.png')
        page.close()
    b.close()
print('errors', errs)
