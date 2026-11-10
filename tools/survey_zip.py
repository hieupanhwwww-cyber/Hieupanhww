# Khảo sát SƠ BỘ bộ mẫu SKP (không cần SketchUp): tên model, tên chi tiết, ảnh thumbnail.
# Không đọc hình học — kích thước/cấu tạo chính xác phải lấy bằng lệnh "Khảo sát bộ mẫu SKP" trong SketchUp.
# Dùng: python3 tools/survey_zip.py <thư_mục_Model_17MM> <thư_mục_ra>
import sys, os, re, json, zipfile, struct, collections

src, out = sys.argv[1], sys.argv[2]
os.makedirs(os.path.join(out, 'thumbs'), exist_ok=True)

def names(d):
    res = []
    for m in re.finditer(rb'[\x20-\x7e\xc0-\xff][\x20-\x7e\x80-\xff]{2,}', d):
        try: s = m.group().decode('utf-8')
        except UnicodeDecodeError: continue
        res.append((m.start(), s))
    return res

def mm_values(d):
    c = collections.Counter()
    for i in range(0, len(d) - 8):
        x = struct.unpack_from('<d', d, i)[0]
        if 0.1 < x < 200 and abs(x * 25.4 - round(x * 25.4, 1)) < 1e-6:
            c[round(x * 25.4, 1)] += 1
    return c

COMMON = {762.0, 800.0, 812.8, 825.5, 889.0, 3378.2, 25.4, 50.8, 254.0, 381.0, 12.7}
rows = []
for fn in sorted(os.listdir(src)):
    if not fn.lower().endswith('.skp'): continue
    p = os.path.join(src, fn)
    z = zipfile.ZipFile(p)
    meta = z.read('meta/meta.dat')
    mname = ''
    m = re.search(rb'j\x00(.)\x00\x00\x00', meta)
    if m:
        n = m.group(1)[0]; mname = meta[m.end():m.end() + n].decode('utf-8', 'replace')
    d = z.read('model.dat')
    parts = []
    for _, s in names(d):
        s2 = re.sub(r'[^0-9A-Za-zÀ-ỹ\s#().,\-_/]+$', '', s)
        s2 = re.sub(r'[a-z@]$', '', s2) if re.search(r'[À-ỹ]', s2) else s2
        letters = sum(ch.isalpha() for ch in s2)
        if letters < 3 or letters < 0.6 * len(s2.replace(' ', '')) or re.match(r'^(Group#|v@|Component#|thumbnails/)', s2):
            continue
        if len(s2) >= 2 and not re.match(r'^(meta/|\[|Solid|Short|Dash|Dot|Double|Long|Arial|Tahoma|ModelProp|[\d.,\s\-]+z?@?$)', s2):
            parts.append(s2.strip())
    seen = []
    for s in parts:
        if s not in seen: seen.append(s)
    vals = mm_values(d)
    big = sorted([v for v in vals if v >= 200 and v not in COMMON])[-6:]
    thick = sorted([v for v in vals if 2 <= v <= 40 and vals[v] >= 3 and v not in COMMON])
    slug = re.sub(r'[^0-9A-Za-z]+', '_', fn[:-4].encode('ascii', 'ignore').decode()).strip('_') or 'mau'
    slug = f'{len(rows):03d}_{slug}'
    th = 'model_thumbnail.png' if 'meta/model_thumbnail.png' in z.namelist() else None
    if th:
        open(os.path.join(out, 'thumbs', slug + '.png'), 'wb').write(z.read('meta/model_thumbnail.png'))
    rows.append({'file': fn, 'model_name': mname, 'parts': seen[:40], 'large_mm': big,
                 'thin_mm': thick, 'thumb': f'thumbs/{slug}.png' if th else None})

json.dump(rows, open(os.path.join(out, 'khao_sat_so_bo.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
with open(os.path.join(out, 'KHAO_SAT_SO_BO.md'), 'w', encoding='utf-8') as f:
    f.write('# Khảo sát SƠ BỘ bộ mẫu DC_17MM (111 file)\n\n')
    f.write('Nguồn: đọc tên chi tiết và số đo dạng mm trong dữ liệu nhị phân SKP, **không phải hình học đã xác minh**. ')
    f.write('Cột “Số đo lớn/nhỏ” chỉ là các giá trị xuất hiện trong file (gợi ý kích thước/độ dày), chưa gán vào tấm cụ thể. ')
    f.write('Cấu tạo chính xác: chạy lệnh “Khảo sát bộ mẫu SKP” trong SketchUp.\n\n')
    f.write('| # | File | Tên model | Chi tiết (tên trong file) | Số đo lớn (mm) | Số đo nhỏ (mm) |\n|---|---|---|---|---|---|\n')
    for i, r in enumerate(rows):
        f.write(f"| {i} | {r['file']} | {r['model_name']} | {', '.join(r['parts'][:14]).replace('|','/')} | {', '.join(str(x) for x in r['large_mm'])} | {', '.join(str(x) for x in r['thin_mm'])} |\n")
print(len(rows))
