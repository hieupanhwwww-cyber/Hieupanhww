# Kiểm thử rà soát giao diện: bàn phím, hộp thoại, nhãn, nhớ màn đang xem
import threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8789),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]; errs=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8789/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    check('vùng thông báo có aria-live sẵn', page.evaluate("() => document.querySelector('.toasts')?.getAttribute('aria-live')")=='polite')
    page.keyboard.press('Tab')
    check('Tab đầu tiên tới nút "Bỏ qua thanh bên"', page.evaluate("() => document.activeElement.dataset.act")=='skip-main')
    page.keyboard.press('Enter')
    check('bấm Enter: con trỏ tới nội dung chính', page.evaluate("() => document.activeElement.id")=='main')
    page.focus('[data-act=palette]'); page.keyboard.press('Enter'); page.wait_for_selector('#pal-q')
    page.wait_for_timeout(200)
    check('mở hộp thoại: phía sau bị khóa (inert)', page.evaluate("() => document.querySelector('#app').inert"))
    for _ in range(12): page.keyboard.press('Tab')
    check('Tab không lọt ra ngoài hộp thoại', page.evaluate("() => !!document.activeElement.closest('.sheet')"))
    page.keyboard.press('Escape'); page.wait_for_timeout(150)
    check('Esc đóng hộp thoại, con trỏ về nút đã mở', page.evaluate("() => document.activeElement.dataset.act")=='palette' and not page.evaluate("() => document.querySelector('#app').inert"))
    unl=page.evaluate("""() => [...document.querySelectorAll('#app input:not([type=hidden]):not([type=file]),#app select,#app textarea')].filter(e => !e.getAttribute('aria-label') && !(e.id && document.querySelector('label[for="'+e.id+'"]')) && !e.closest('label')).map(e=>e.id||e.className)""")
    check('ô nhập trên màn đều có nhãn', not unl, unl)
    page.evaluate("() => { S.tab='settings'; render(); }"); page.wait_for_selector('#st-phone')
    check('SĐT cửa hàng mở bàn phím số', page.get_attribute('#st-phone','inputmode')=='tel')
    page.click('[data-act=new-quote]'); page.wait_for_selector('.editor'); oid=page.evaluate("() => S.orderId")
    page.reload(); page.wait_for_selector('.editor')
    check('tải lại trang: về đúng báo giá đang soạn', page.evaluate("() => S.orderId")==oid)
    check('không lỗi JS', not errs, errs)
    b.close()
srv.shutdown()
print(f"{sum(res)}/{len(res)} passed")
