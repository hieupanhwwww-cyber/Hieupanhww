from playwright.sync_api import sync_playwright
import http.server, threading, functools
H=functools.partial(http.server.SimpleHTTPRequestHandler, directory='/home/claude/so-noi-that')
class Q(H.func):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8766),functools.partial(Q,directory='/home/claude/so-noi-that'))
threading.Thread(target=srv.serve_forever,daemon=True).start()
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page()
    pg.add_init_script(open('test/mock.js').read())
    pg.on('pageerror',lambda e:print('ERR',e)); pg.on('console',lambda m:print('CON',m.type,m.text))
    pg.route('**fonts.g*',lambda r:r.abort())
    pg.goto('http://127.0.0.1:8766/so-noi-that.html'); pg.wait_for_timeout(2500)
    print(pg.inner_text('body')[:300])
srv.shutdown()
