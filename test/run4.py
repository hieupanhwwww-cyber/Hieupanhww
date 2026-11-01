import json, os, sys, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out4'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8774),functools.partial(Q,directory=ROOT+'/pwa'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(bool(c)); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':1180,'height':820}, accept_downloads=True, locale='vi-VN', timezone_id='Asia/Bangkok')
    ctx.route('**fonts.g*',lambda r:r.abort())
    page=ctx.new_page(); page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8774/'); page.wait_for_selector('.list-head')
    check('own-site install banner', 'Thêm vào MH chính' in page.inner_text('.main'))
    page.wait_for_function("() => navigator.serviceWorker && navigator.serviceWorker.controller !== null || (navigator.serviceWorker.getRegistration().then(r=>!!r))", timeout=10000)
    reg=page.evaluate("async () => { const r = await navigator.serviceWorker.ready; return !!r.active }")
    check('service worker active', reg)
    man=page.evaluate("async () => (await (await fetch('manifest.webmanifest')).json()).display")
    check('manifest standalone', man=='standalone')
    # restore a backup produced from cloud version shape
    backup={'app':'so-noi-that','version':1,'exportedAt':'2026-10-20T10:00:00Z','orders':[],'customers':[],'catalog':[],'app':'so-noi-that'}
    page.click('[data-act=seed-demo]'); page.evaluate("() => { S.tab='orders'; render(); }"); page.wait_for_timeout(300)
    # old-format backup (as produced by the live version) + new-format backup via the button
    legacy=page.evaluate("() => { const d={app:'so-noi-that',version:1,exportedAt:new Date().toISOString()}; for (const c of COLS) d[c]=Store.list(c); return d }")
    open(OUT+'/legacy.json','w').write(json.dumps(legacy, ensure_ascii=False))
    page.click('.rail [data-tab=settings]'); page.wait_for_selector('[data-act=backup]')
    with page.expect_download(timeout=20000) as dl: page.click('.card [data-act=backup]')
    dl.value.save_as(OUT+'/backup.json')
    check('new backup has marker', json.load(open(OUT+'/backup.json'))['format']=='so-noi-that')
    page.evaluate("() => { for (const c of COLS) for (const d of Store.list(c)) Store.del(c,d.id); render(); }"); page.wait_for_timeout(300)
    page.click('.rail [data-tab=settings]'); page.wait_for_selector('#restore-in', state='attached')
    page.set_input_files('#restore-in', OUT+'/backup.json'); page.wait_for_selector('.sheet-f [data-sa=yes]'); page.click('.sheet-f [data-sa=yes]')
    page.wait_for_timeout(800)
    n=page.evaluate("() => Store.list('orders').length")
    check('restore new backup', n==5, n)
    page.evaluate("() => { for (const c of COLS) for (const d of Store.list(c)) Store.del(c,d.id); render(); }"); page.wait_for_timeout(300)
    page.set_input_files('#restore-in', OUT+'/legacy.json'); page.wait_for_selector('.sheet-f [data-sa=yes]'); page.click('.sheet-f [data-sa=yes]'); page.wait_for_timeout(800)
    n=page.evaluate("() => [Store.list('orders').length, Store.list('catalog').length, !!Store.get('app','settings') || true]")
    check('restore OLD-format backup', n[0]==5 and n[1]==13, n)
    # reload with page controlled by SW, then go offline and reload
    page.evaluate("() => localStorage.removeItem('snt-view')"); page.reload(); page.wait_for_selector('.ocard'); page.wait_for_timeout(500)
    ctx.set_offline(True)
    page.evaluate("() => localStorage.removeItem('snt-view')"); page.reload(); page.wait_for_selector('.ocard', timeout=15000)
    n=page.evaluate("() => Store.list('orders').length")
    check('opens offline with data', n==5, n)
    # edit offline, reload offline
    page.click('.list-head [data-act=new-quote]'); page.wait_for_selector('#qf-name'); page.fill('#qf-name','Khách ngoại tuyến'); page.wait_for_timeout(900)
    page.evaluate("() => localStorage.removeItem('snt-view')"); page.reload(); page.wait_for_selector('.ocard', timeout=15000)
    check('offline edit persisted', 'Khách ngoại tuyến' in page.inner_text('#cards'))
    ctx.set_offline(False)
    # export PNG → falls back to download in Chromium (no Web Share)
    page.evaluate("() => openOrder(Store.list('orders').find(o=>o.status==='building').id)"); page.wait_for_selector('[data-act=png]')
    with page.expect_download(timeout=20000) as dl: page.click('[data-act=png]')
    d=dl.value; d.save_as(OUT+'/'+d.suggested_filename)
    check('PNG download on own site', d.suggested_filename.endswith('.png'), d.suggested_filename)
    page.screenshot(path=OUT+'/pwa-landscape.png')
    check('no JS errors', not errs, errs[:3])
    b.close()
srv.shutdown(); print(f"{sum(res)}/{len(res)} passed"); sys.exit(0 if all(res) else 1)
