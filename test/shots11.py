import os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out11'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8784),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    for name, vp in [('ipad', {'width':1180,'height':820}), ('phone', {'width':390,'height':844})]:
        page=b.new_page(viewport=vp); page.route('**fonts.g*',lambda r:r.abort())
        page.add_init_script(open(ROOT+'/test/mock.js').read()); page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto('http://127.0.0.1:8784/test/local.html'); page.wait_for_selector('[data-act=seed-demo]')
        page.click('[data-act=seed-demo]'); page.wait_for_timeout(300)
        page.evaluate("() => { saveMeta({cashStart:{date: addDays(today(), -120), amount: 50000000}}); document.querySelector('.toasts')?.remove(); S.tab='stats'; S.fin='pl'; render(); }"); page.wait_for_timeout(150)
        page.screenshot(path=f'{OUT}/{name}-1-cong-so.png')
        page.evaluate("() => { document.querySelector('[data-pane=stats]').scrollTop=9999 }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-2-cong-so-duoi.png')
        page.evaluate("() => plMonthSheet(addDays(today(), -31).slice(0,7))"); page.wait_for_timeout(250)
        page.screenshot(path=f'{OUT}/{name}-3-so-thang.png')
        page.keyboard.press('Escape')
        page.evaluate("() => { S.tab='today'; render(); }"); page.wait_for_timeout(100)
        page.screenshot(path=f'{OUT}/{name}-4-homnay.png')
        page.close()
    b.close()
print('errors', errs)
