# Ảnh chụp các màn chính (dùng phông cục bộ) để soát giao diện
import os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; TAG=sys.argv[1] if len(sys.argv)>1 else 'new'; OUT=ROOT+'/test/out14'
ONLY=sys.argv[2].split(',') if len(sys.argv)>2 else None
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8790),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
FONTS="""
@font-face{font-family:"Be Vietnam Pro";font-weight:400;src:url(/test/fonts/BeVietnamPro-Regular.ttf)}
@font-face{font-family:"Be Vietnam Pro";font-weight:500;src:url(/test/fonts/BeVietnamPro-Medium.ttf)}
@font-face{font-family:"Be Vietnam Pro";font-weight:600;src:url(/test/fonts/BeVietnamPro-SemiBold.ttf)}
@font-face{font-family:"Be Vietnam Pro";font-weight:700;src:url(/test/fonts/BeVietnamPro-Bold.ttf)}
@font-face{font-family:"Bricolage Grotesque";font-weight:200 800;font-stretch:75% 100%;src:url(/test/fonts/Bricolage.ttf)}
"""
errs=[]
def want(n): return not ONLY or n in ONLY
with sync_playwright() as p:
    b=p.chromium.launch()
    for name, vp, dark in [('ipad', {'width':1180,'height':820}, False), ('phone', {'width':390,'height':844}, False), ('dark', {'width':1180,'height':820}, True)]:
        if not want(name): continue
        page=b.new_page(viewport=vp, device_scale_factor=1, color_scheme='dark' if dark else 'light'); page.route('**fonts.g*',lambda r:r.abort())
        page.add_init_script(open(ROOT+'/test/mock.js').read()); page.on('pageerror',lambda e:errs.append(str(e)))
        page.goto('http://127.0.0.1:8790/test/local.html'); page.add_style_tag(content=FONTS); page.wait_for_selector('[data-act=seed-demo]')
        page.click('[data-act=seed-demo]'); page.wait_for_timeout(300)
        page.evaluate("() => { saveMeta({cashStart:{date: addDays(today(), -120), amount: 50000000}}); document.querySelector('.toasts')?.remove(); }")
        page.evaluate("() => document.fonts.ready"); page.wait_for_timeout(200)
        def go(js, fn, wait=150):
            page.evaluate("() => { document.querySelectorAll('.toast').forEach(t=>t.remove()); while (sheets.length) closeSheet(); " + js + " }"); page.wait_for_timeout(wait)
            page.screenshot(path=f'{OUT}/{TAG}-{name}-{fn}.png')
        go("S.tab='today'; render();", '1-homnay')
        o_build="Store.list('orders').find(o=>o.status==='building')"
        go(f"const o={o_build}; S.tab='orders'; S.orderId=o.id; S.view='detail'; S.filter='all'; render();", '2-don')
        if name=='dark': page.close(); continue
        go("const o=Store.list('orders').find(o=>o.status==='quote'); S.tab='orders'; S.orderId=o.id; S.view='edit'; render();", '3-baogia')
        go("S.tab='stats'; S.fin='rev'; S.orderId=null; S.view='list'; render();", '4-doanhthu')
        go("S.tab='stats'; S.fin='cash'; render();", '5-thuchi')
        go("S.tab='catalog'; S.catTab='items'; render();", '6-danhmuc')
        go("S.tab='settings'; render();", '7-caidat')
        go(f"const o={o_build}; S.tab='orders'; S.orderId=o.id; S.view='detail'; render(); paySheet(o);", '8-thutien', 400)
        if name=='phone':
            go("S.tab='orders'; S.orderId=null; S.view='list'; render();", '9-danhsach')
        page.close()
    b.close()
srv.shutdown()
print('errors', errs)
