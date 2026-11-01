# Ảnh chụp giao diện macOS + tính lãi
import os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out6'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8776),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for scheme in ['light','dark']:
        page=b.new_page(viewport={'width':1180,'height':820}, color_scheme=scheme)
        page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
        page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto('http://127.0.0.1:8776/test/local.html'); page.wait_for_selector('[data-act=seed-demo]')
        page.click('[data-act=seed-demo]'); page.wait_for_timeout(300)
        page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='building').id)"); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/{scheme}-1-don.png')
        if scheme=='dark': page.close(); continue
        page.evaluate("() => { const pc = document.getElementById('profit-card'); pc && pc.scrollIntoView(); }"); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/light-2-lai.png')
        page.click('#profit-card [data-act=profit-edit]'); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/light-3-sheet-lai.png')
        page.keyboard.press('Escape')
        page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='quote').id)"); page.wait_for_timeout(300)
        page.screenshot(path=f'{OUT}/light-4-bao-gia.png')
        page.evaluate("() => { S.tab='stats'; render(); }"); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/light-5-thong-ke.png')
        page.evaluate("() => { S.tab='catalog'; render(); }"); page.wait_for_timeout(200)
        page.screenshot(path=f'{OUT}/light-6-danh-muc.png')
        page.close()
    ph=b.new_page(viewport={'width':390,'height':844})
    ph.add_init_script(open(ROOT+'/test/mock.js').read()); ph.route('**fonts.g*',lambda r:r.abort())
    ph.goto('http://127.0.0.1:8776/test/local.html'); ph.wait_for_selector('[data-act=seed-demo]')
    ph.click('[data-act=seed-demo]'); ph.wait_for_timeout(300)
    ph.screenshot(path=f'{OUT}/phone-1.png')
    ph.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='building').id)"); ph.wait_for_timeout(300)
    ph.evaluate("() => document.getElementById('profit-card').scrollIntoView()"); ph.wait_for_timeout(200)
    ph.screenshot(path=f'{OUT}/phone-2-lai.png')
    b.close()
print('errors', errs)
