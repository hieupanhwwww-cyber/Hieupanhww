# Kiểm thử: cộng sổ theo tháng, chốt sổ, lãi theo đơn chốt
import os, threading, http.server, functools, base64, csv, io
from playwright.sync_api import sync_playwright
ROOT='/home/claude/so-noi-that'; OUT=ROOT+'/test/out11'; os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8785),functools.partial(Q,directory=ROOT))
threading.Thread(target=srv.serve_forever,daemon=True).start()
res=[]
def check(n,c,x=''): res.append(c); print(('PASS ' if c else 'FAIL ')+n+(' :: '+str(x) if x!='' else ''))
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); page=b.new_page(viewport={'width':1180,'height':820})
    page.add_init_script(open(ROOT+'/test/mock.js').read()); page.route('**fonts.g*',lambda r:r.abort())
    page.on('pageerror',lambda e:errs.append(str(e)))
    page.goto('http://127.0.0.1:8785/test/local.html'); page.wait_for_selector('[data-act=new-quote]')
    # dữ liệu: tháng trước (M1) và tháng này (M2)
    M=page.evaluate("""async () => {
      const m2 = today().slice(0,7), d2 = m2 + '-05'; const d1x = new Date(); d1x.setDate(1); d1x.setMonth(d1x.getMonth()-1); const m1 = dstr(d1x).slice(0,7), d1 = m1 + '-10';
      saveMeta({ cashStart: { date: m1 + '-01', amount: 10000000 } });
      const mk = async (name, total, closeDate, dep) => { const q=newQuote(); q.customer={name,phone:'',address:''}; q.rows=[newRow({name:'Tủ áo cánh mở',unit:'bộ',qty:1,price:total})];
        const o=createOrderFrom(q); Store.put('orders',o,0); S.orderId=o.id; await doClose(o, closeDate, dep, 'transfer', null, ''); return o; };
      const A = await mk('Khách A', 30000000, d1, 15000000);   // chốt tháng trước, cọc 15tr
      const B = await mk('Khách B', 20000000, d2, 8000000);    // chốt tháng này, cọc 8tr
      const C = await mk('Khách C', 10000000, d2, 0);          // chốt tháng này, chưa có chi phí
      A.payments.push({ id: uid('p'), no: 2, amount: 10000000, date: d2, method: 'cash', note: 'Đợt 2', createdAt: new Date().toISOString() }); touchOrder(A, 0);
      const put = (type, date, amount, cat, oid='') => Store.put('cash', { id: uid('t'), type, date, amount, cat, oid, note: '', method: 'cash', createdAt: new Date().toISOString() }, 0);
      put('out', d1, 12000000, 'Vật tư, ván', A.id); put('out', d1, 2000000, 'Quảng cáo');
      put('out', d2, 9000000, 'Vật tư, ván', B.id); put('out', d2, 3000000, 'Nhân công, thợ', A.id); put('out', d2, 1000000, 'Điện, nước, xăng');
      put('in', d2, 500000, 'Bán phế liệu'); put('in', d2, 20000000, 'Góp vốn, vay');
      return { m1, m2, A: A.id, B: B.id, C: C.id };
    }""")
    L=page.evaluate(f"() => ledger(['{M['m1']}','{M['m2']}']).map(r => ({{m:r.m, open:r.open, income:r.income, capital:r.capital, out:r.out, profit:r.profit, pct:r.pct, close:r.close}}))")
    l1,l2=L
    check('tháng trước: tồn đầu = số dư ban đầu 10tr', l1['open']==10000000, l1)
    check('tháng trước: thu 15tr, chi 14tr, lãi 1tr', l1['income']==15000000 and l1['out']==14000000 and l1['profit']==1000000, l1)
    check('tháng trước: tồn cuối = 10 + 15 − 14 = 11tr', l1['close']==11000000)
    check('tháng này: tồn đầu = tồn cuối tháng trước', l2['open']==11000000)
    check('tháng này: thu 18,5tr (không tính 20tr góp vốn), chi 13tr', l2['income']==18500000 and l2['capital']==20000000 and l2['out']==13000000, l2)
    check('tháng này: lãi 5,5tr, tỷ suất 29,7%', l2['profit']==5500000 and abs(l2['pct']-5500000/18500000*100)<0.01, l2)
    check('tháng này: tồn cuối = 11 + 38,5 − 13 = 36,5tr (có tiền góp vốn)', l2['close']==36500000, l2)
    A=page.evaluate(f"() => accrual(['{M['m1']}','{M['m2']}']).map(r => ({{rev:r.rev, ocost:r.ocost, gen:r.gen, oin:r.oin, profit:r.profit, none:r.none}}))")
    a1,a2=A
    check('lãi theo đơn tháng trước: đơn A 30tr − chi đơn 15tr (gồm 3tr tháng sau) − chi chung 2tr = 13tr', a1['rev']==30000000 and a1['ocost']==15000000 and a1['gen']==2000000 and a1['profit']==13000000, a1)
    check('lãi theo đơn tháng này: B 20tr + C 10tr − 9tr − chung 1tr + thu khác 0,5tr = 20,5tr; C chưa có chi phí', a2['rev']==30000000 and a2['ocost']==9000000 and a2['gen']==1000000 and a2['oin']==500000 and a2['profit']==20500000 and a2['none']==1, a2)
    # giao diện
    page.evaluate("() => { S.tab='stats'; S.fin='pl'; render(); }"); page.wait_for_selector('.ledger')
    hero=page.inner_text('.kpi.hero')
    check('ô Tồn quỹ hiện 36.500.000', '36.500.000' in hero, hero.replace('\n',' '))
    check('cảnh báo đơn chưa có chi phí', '1 đơn chốt chưa có chi phí' in page.inner_text('details[data-sect=pl-acc]'))
    # chốt sổ tháng trước
    page.click(f'.ledger tr[data-m="{M["m1"]}"] [data-act=pl-close]'); page.wait_for_timeout(200)
    check('chốt sổ tháng trước', page.evaluate(f"() => !!books()['{M['m1']}']") and 'Đã chốt' in page.inner_text(f'.ledger tr[data-m="{M["m1"]}"]'))
    check('tháng hiện tại không chốt được (đang mở)', 'Đang mở' in page.inner_text(f'.ledger tr[data-m="{M["m2"]}"]'))
    # ghi thêm khoản vào tháng đã chốt → hỏi xác nhận
    page.evaluate("() => cashSheet('out')"); page.wait_for_selector('#cs-amt')
    page.fill('#cs-amt','500.000'); page.evaluate(f"() => {{ const i=document.querySelector('#cs-date'); i.value='{M['m1']}-20'; }}")
    page.click('.sheet-f [data-sa=save]'); page.wait_for_timeout(200)
    t=page.locator('.sheet').last.inner_text()
    check('ghi khoản vào tháng đã chốt: hỏi xác nhận trước', 'đã chốt sổ' in t, t[:80])
    page.click('.sheet-f [data-sa=yes]'); page.wait_for_timeout(250)
    check('xác nhận xong vẫn ghi được', page.evaluate(f"() => Store.list('cash').some(e => e.date === '{M['m1']}-20')"))
    check('tháng đó hiện “Đổi sau chốt”', 'Đổi sau chốt' in page.inner_text(f'.ledger tr[data-m="{M["m1"]}"]'))
    # mở lại sổ, chốt lại
    page.click(f'.ledger tr[data-m="{M["m1"]}"] td >> nth=0'); page.wait_for_selector('.sheet-f [data-sa=reopen]')
    page.click('.sheet-f [data-sa=reopen]'); page.click('.sheet-f [data-sa=yes]'); page.wait_for_timeout(200)
    check('mở lại sổ', page.evaluate(f"() => !books()['{M['m1']}']"))
    # số dư ban đầu
    page.click('[data-act=pl-start]'); page.wait_for_selector('#cs0-amt'); page.fill('#cs0-amt','12.000.000'); page.click('.sheet-f [data-sa=ok]'); page.wait_for_timeout(200)
    check('sửa số dư ban đầu → tồn quỹ cộng thêm 2tr', '38.000.000' in page.inner_text('.kpi.hero'), page.inner_text('.kpi.hero').replace('\n',' '))
    # Hôm nay
    page.evaluate("() => { S.tab='today'; render(); }")
    tl=page.inner_text('.tiles')
    check('Hôm nay: ô Lãi tháng này (thu − chi) có tỷ suất và tồn quỹ', 'Lãi tháng này' in tl and 'tỷ suất' in tl and 'tồn quỹ' in tl, tl.replace('\n',' '))
    # xuất Excel
    page.evaluate("() => { S.tab='stats'; S.fin='pl'; render(); }")
    page.click('[data-act=pl-csv]'); page.wait_for_function("() => (window.__downloads||[]).some(d => d.filename.startsWith('Cong-so'))", timeout=10000)
    d=page.evaluate("() => window.__downloads.filter(d => d.filename.startsWith('Cong-so')).at(-1)")
    raw=base64.b64decode(d['b64']).decode('utf-8'); rows=list(csv.reader(io.StringIO(raw.lstrip('﻿'))))
    tot=[r for r in rows if r and r[0]=='CỘNG'][0]
    check('Excel cộng sổ: có dòng CỘNG với lãi và tồn cuối', len(tot)>=9 and int(tot[8])==38000000, tot)
    check('Excel có phần Lãi theo đơn chốt', any(r and r[0]=='LÃI THEO ĐƠN CHỐT' for r in rows))
    check('không lỗi JS', not errs, errs)
    b.close()
print(f'{sum(res)}/{len(res)} passed')
