# Đọc file .skp (SketchUp 2021+) NGOÀI SketchUp: cây TLV của model.dat → nhóm, layer, đỉnh/cạnh/mặt.
# Dùng: giải nén file .skp (là gói zip) lấy model.dat, rồi:  python3 tools/skp_read.py model.dat [tên_nhóm ...]
# In thống kê hình học (số đỉnh/cạnh/mặt, kích thước, layer của nhóm/cạnh/mặt) cho các nhóm ABF.
import struct,sys,os,collections
sys.setrecursionlimit(10000)
def parse(d,a,b,depth=0,maxdepth=40):
    """trả list (tag, start, end, children|None) nếu [a,b) là dãy TLV hợp lệ, ngược lại None"""
    out=[];i=a
    while i<b:
        if i+6>b: return None
        tag,ln=struct.unpack_from('<HI',d,i)
        if ln>b-i-6: return None
        s=i+6;e=s+ln
        kids=None
        if ln>=6 and depth<maxdepth:
            kids=parse(d,s,e,depth+1,maxdepth)
        out.append((tag,s,e,kids))
        i=e
    return out
MM=25.4
class Skp:
    def __init__(s,path):
        s.d=open(path,'rb').read(); s.t=parse(s.d,0,len(s.d))
        s.defs={}      # id -> node 5000
        s.inst=[]      # (name, tf13, defid, own_id, layer_id, parent_def_id, node)
        s.strings={}   # id -> name (layer v.v.)
        s._walk(s.t,None)
    def raw(s,n): return s.d[n[1]:n[2]]
    def kid(s,n,tag):
        for k in (n[3] or []):
            if k[0]==tag: return k
    def kids(s,n,tag): return [k for k in (n[3] or []) if k[0]==tag]
    def rid(s,n):  # id của thực thể: tìm 1502 lồng trong 2000/1500
        st=[n]
        for _ in range(4):
            nx=[]
            for x in st:
                for k in (x[3] or []):
                    if k[0]==1502: return s.raw(k).hex()
                    if k[0] in (2000,1500): nx.append(k)
            st=nx
    def layer_of(s,n):
        e=s.kid(n,2000)
        if e:
            l=s.kid(e,2002)
            if l: return s.raw(l).hex()
    def _walk(s,nodes,pdef):
        for n in nodes:
            tag=n[0]
            if tag==5000:
                i=s.rid(n); s.defs[i]=n
                if n[3]: s._walk(n[3],i)
                continue
            if tag==6500:
                nm=s.kid(n,6501); tf=s.kid(n,6502); df=s.kid(n,6503)
                s.inst.append(((s.raw(nm).decode('utf-8','replace') if nm else ''),
                               struct.unpack('<13d',s.raw(tf)) if tf and n and (tf[2]-tf[1])==104 else None,
                               s.raw(df).hex() if df else None, s.rid(n), s.layer_of(n), pdef, n))
            if n[3]: s._walk(n[3],pdef)
    def geom(s,defid):
        n=s.defs.get(defid)
        if not n: return None
        V={}
        vl=s.kid(n,5001)
        for v in s.kids(vl,2500) if vl else []:
            p=s.kid(v,2501); V[s.rid(v)]=tuple(x*MM for x in struct.unpack('<3d',s.raw(p)))
        E={}
        el=s.kid(n,5002)
        for e in s.kids(el,3000) if el else []:
            a=s.kid(e,3001); b=s.kid(e,3002)
            E[s.rid(e)]=(s.raw(a).hex(),s.raw(b).hex(),s.layer_of(e))
        F=[]
        fl=s.kid(n,5003)
        for f in s.kids(fl,3500) if fl else []:
            pl=s.kid(f,3501); loops=[]
            lp=s.kid(f,3502)
            for L in s.kids(lp,4500) if lp else []:
                inner=s.kid(L,4501) or L
                es=[s.raw(s.kid(u,4001)).hex() for u in s.kids(inner,4000)]
                loops.append(es)
            F.append((struct.unpack('<4d',s.raw(pl)) if pl and pl[2]-pl[1]==32 else None, loops, s.layer_of(f)))
        sub=[i for i in s.inst if i[5]==defid]
        return V,E,F,sub
    def bbox(s,defid):
        g=s.geom(defid)
        if not g or not g[0]: return None
        xs=list(g[0].values())
        return [min(p[k] for p in xs) for k in range(3)],[max(p[k] for p in xs) for k in range(3)]
s=Skp(sys.argv[1])
print('defs',len(s.defs),'instances',len(s.inst))
# bảng layer: tìm bản ghi có id trùng layer ref và có chuỗi tên
want=sys.argv[2:] or ['_ABF_sideDrillDepth','_ABF_sideDrill','_ABF_minifixBolts','_ABF_minifixPlasticBase','_ABF_Intersect','ABF_D35']
by=collections.defaultdict(list)
for i in s.inst: by[i[0]].append(i)
for nm in want:
    L=by.get(nm,[])
    print('\n=====',nm,'x',len(L))
    shapes=collections.Counter()
    for name,tf,df,own,lay,pdef,node in L:
        g=s.geom(df)
        if not g: shapes[('no-def',)]+=1; continue
        V,E,F,sub=g
        bb=s.bbox(df)
        size=tuple(round(bb[1][k]-bb[0][k],2) for k in range(3)) if bb else None
        elay=collections.Counter(e[2] for e in E.values()); flay=collections.Counter(f[2] for f in F)
        shapes[(len(V),len(E),len(F),size,lay,tuple(sorted(elay)),tuple(sorted(flay)),len(sub))]+=1
    for k,v in shapes.most_common(8): print(v,'×  V,E,F,size(mm),group_layer,edge_layers,face_layers,subgroups =',k)
    # ví dụ đầy đủ
    if L:
        name,tf,df,own,lay,pdef,node=L[0]
        V,E,F,sub=s.geom(df)
        print(' ví dụ tf=',[round(x,4) for x in tf] if tf else None)
        print(' đỉnh(mm)=',[tuple(round(c,2) for c in p) for p in list(V.values())[:12]])
        print(' mặt: plane=',[tuple(round(c,3) for c in f[0]) if f[0] else None for f in F][:4],' loops=',[[len(l) for l in f[1]] for f in F][:4])
