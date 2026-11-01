# Kiểm thử: báo giá PDF/PNG hiện đã đặt cọc và số còn phải trả
import base64, os, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out5'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8775),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8775/test/local.html'); page.wait_for_selector('[data-act=seed-demo]')
    page.click('[data-act=seed-demo]'); page.evaluate("() => { S.tab='orders'; render(); }"); page.wait_for_timeout(300)
    page.evaluate("() => saveSettings({bankBin:'970436', bankAccount:'0011001234567', bankHolder:'NGUYEN VAN HIEU'})")
    # spy: ghi lại chữ vẽ lên trang
    info=page.evaluate("""async () => {
      const out = {};
      const grab = async (o, src, name) => {
        const res = await renderQuotePages(o, src);
        const texts = [];
        const orig = CanvasRenderingContext2D.prototype.fillText;
        const pages = res.pages;
        for (let i = 0; i < pages.length; i++) {
          const b64 = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(pages[i].blob); });
          out[name + '-' + i] = b64;
        }
        return res;
      };
      const os = Store.list('orders');
      const o2 = os.find(o => o.status === 'closed');   // chỉ có cọc
      const o1 = os.find(o => o.status === 'building'); // cọc + đợt 2
      const o4 = os.find(o => o.status === 'quote');
      return { o1: o1.id, o2: o2.id, o4: o4.id, o2v: lastVersion(o2).no, o2paid: orderPaid(o2), o2total: orderTotal(o2), o1paid: orderPaid(o1), o1total: orderTotal(o1) };
    }""")
    print(info)
    # bắt chữ: bọc hàm text trong layout bằng cách chặn fillText
    page.evaluate("""() => { window.__txt = []; const f = CanvasRenderingContext2D.prototype.fillText; CanvasRenderingContext2D.prototype.fillText = function (t, ...a) { window.__txt.push(String(t)); return f.call(this, t, ...a); }; }""")
    def render(oid, src, name):
        page.evaluate("() => { window.__txt = []; }")
        n=page.evaluate("""async ([id, src]) => { const o = Store.get('orders', id); const res = await renderQuotePages(o, src);
          window.__last = await Promise.all(res.pages.map(p => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(p.blob); })));
          const png = await makePng(res.pages, res.size); window.__png = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(png); });
          return res.pages.length; }""", [oid, src])
        imgs=page.evaluate("() => window.__last")
        for i,d in enumerate(imgs): open(f'{OUT}/{name}-{i+1}.jpg','wb').write(base64.b64decode(d.split(',')[1]))
        open(f'{OUT}/{name}.png','wb').write(base64.b64decode(page.evaluate("() => window.__png").split(',')[1]))
        return ' | '.join(page.evaluate("() => window.__txt")), n
    t2,n2=render(info['o2'], str(info['o2v']), 'coc')
    check('đơn chỉ có cọc: hiện "Đã đặt cọc"', 'Đã đặt cọc' in t2, n2)
    check('đơn chỉ có cọc: hiện "CÒN PHẢI THANH TOÁN" đúng số', 'CÒN PHẢI THANH TOÁN' in t2 and page.evaluate(f"() => money({info['o2total']-info['o2paid']})") + ' đ' in t2)
    check('đơn chỉ có cọc: số tiền bằng chữ còn lại', 'Còn phải thanh toán bằng chữ' in t2)
    check('cọc chưa đủ đợt 1: ghi số còn thiếu, QR thu nốt phần thiếu', 'Còn 2.712.000' in t2 and 'Quét để chuyển khoản đợt 1' in t2 and '2.712.000 đ' in t2)
    t1,n1=render(info['o1'], 'x', 'hai-dot')
    check('đơn 2 lần trả: liệt kê cả 2 khoản', t1.count('Đã đặt cọc') + t1.count('Đã thanh toán ngày') >= 2)
    check('đơn đã trả hết đợt 1: ghi "Đã thu", QR sang đợt sau', 'Đã thu' in t1 and 'Quét để chuyển khoản đợt 1' not in t1)
    check('đơn 2 lần trả: còn lại đúng', page.evaluate(f"() => money({max(0,info['o1total']-info['o1paid'])})") + ' đ' in t1)
    t4,n4=render(info['o4'], 'draft', 'bao-gia-moi')
    check('báo giá chưa chốt: không có dòng cọc', 'Đã đặt cọc' not in t4 and 'CÒN PHẢI THANH TOÁN' not in t4 and 'Quét để chuyển khoản đợt 1' in t4)
    o2 = info['o2']
    old = page.evaluate("""([id]) => { const o = Store.get('orders', id); return o.versions.length > 1 ? o.versions[0].no : null; }""", [o2])
    if old:
        tv,_=render(o2, str(old), 'ban-cu')
        check('bản cũ đã thay thế: không trừ cọc', 'Đã đặt cọc' not in tv)
    check('không lỗi JS', not errs, errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
