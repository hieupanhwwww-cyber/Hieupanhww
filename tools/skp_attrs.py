# Đọc attribute dictionary trong file .skp (SketchUp 2021+) NGOÀI SketchUp: giải nén model.dat từ file .skp (là gói zip)
# rồi chạy: python3 tools/skp_attrs.py model.dat   — in ra offset, khóa, giá trị. Dùng để xem dữ liệu ABF ghi vào model.
import re,struct,sys
d=open(sys.argv[1],'rb').read()
def val(o):
    # returns (value, next_offset); expects a4 38 <len>
    if d[o:o+2]!=b'\xa48': return (None,o)
    ln=struct.unpack_from('<I',d,o+2)[0]; body=o+6; end=body+ln
    if ln==0: return (None,end)
    t=d[body:body+2]; l2=struct.unpack_from('<I',d,body+2)[0]; p=body+6
    if t==b'\xad8': return (d[p:p+l2].decode('utf-8','replace'),end)
    if t==b'\xa98': return (round(struct.unpack_from('<d',d,p)[0],4),end)
    if t==b'\xa78': return (struct.unpack_from('<i',d,p)[0],end)
    if t==b'\xaa8': return (bool(d[p]),end)
    if t==b'\xae8':
        arr=[];q=p
        while q<p+l2:
            v,q2=val(q)
            if q2==q: break
            arr.append(v);q=q2
        return (arr,end)
    return ('?'+t.hex(),end)
out=[]
for m in re.finditer(rb'\xb66(.)\x00\x00\x00',d):
    n=m.group(1)[0]; k=d[m.end():m.end()+n]
    try: k=k.decode('utf-8')
    except: continue
    if not re.match(r'^[\w .\-/]+$',k): continue
    v,_=val(m.end()+n)
    out.append((m.start(),k,v))
import json
skip={'tf','params','data'}
for o,k,v in out:
    if k in skip: continue
    print(o,k,json.dumps(v,ensure_ascii=False)[:400])
