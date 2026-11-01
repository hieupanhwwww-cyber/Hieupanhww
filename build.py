import pathlib
P=pathlib.Path('/home/claude/so-noi-that')
css=(P/'parts/style.css').read_text()
js='\n'.join((P/'parts'/f).read_text() for f in ['core.js','qr.js','pdf.js','ui.js','profit.js','library.js','orders.js','home.js','cash.js','ledger.js','team.js','events.js'])
html=f'''<title>Sổ Nội Thất</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Sổ Nội Thất">
<meta name="theme-color" content="#F4EFE8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style>
{css}
</style>
<div id="app" class="app"></div>
<script>
{js}
</script>
'''
(P/'so-noi-that.html').write_text(html)
(P/'test/local.html').write_text('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>'+html+'</body></html>')
print(len(html))

# ---------- bản web app cài lên iPad (GitHub Pages) ----------
import re, time, shutil
reset = ":root{padding-top:env(safe-area-inset-top,0px)}html{box-sizing:border-box}body{margin:0;font-size:14px}img{max-width:100%}"
pwa_head = f"""<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Sổ Nội Thất</title>
<meta name="description" content="Lập báo giá, chốt đơn và theo dõi thanh toán cho nội thất trọn gói">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Sổ Nội Thất">
<meta name="theme-color" content="#F4EFE8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#17130F" media="(prefers-color-scheme: dark)">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/icon-180.png">
<link rel="icon" type="image/png" href="icons/favicon-32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style>
{reset}
{css}
.wide .rail{{padding-bottom:max(14px,env(safe-area-inset-bottom,0px))}}
</style>
</head>
<body>
<div id="app" class="app"></div>
<script>
{js}
</script>
</body>
</html>
"""
D = P/'pwa'
(D/'index.html').write_text(pwa_head)
build = time.strftime('%Y%m%d%H%M%S')
sw = (D/'sw.js').read_text()
sw = re.sub(r"const VERSION = 'snt-[^']*';", f"const VERSION = 'snt-{build}';", sw)
(D/'sw.js').write_text(sw)
print('pwa built', build)
