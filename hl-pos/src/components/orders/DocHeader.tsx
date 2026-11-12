import type { Settings } from '@/lib/settings';

/** Phần đầu giấy tờ in: logo + thông tin cửa hàng. */
export function DocHeader({ st }: { st: Settings }) {
  return (
    <div className="flex items-start gap-4 border-b-2 pb-3" style={{ borderColor: '#8b5e3c' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {st.logo && <img src={st.logo} alt="" className="h-16 w-16 object-contain" />}
      <div className="flex-1">
        <div className="text-xl font-bold uppercase" style={{ color: '#6f4a2f' }}>{st.name}</div>
        {st.tagline && <div className="text-sm italic">{st.tagline}</div>}
        <div className="text-sm">{st.address}</div>
        <div className="text-sm">ĐT: {st.phone}{st.email ? ` · ${st.email}` : ''}</div>
      </div>
    </div>
  );
}

export function SignBox({ title, name, img, note }: { title: string; name?: string; img?: string | null; note?: string }) {
  return (
    <div className="flex-1 text-center">
      <div className="font-semibold">{title}</div>
      <div className="text-xs italic">(Ký, ghi rõ họ tên)</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <div className="flex h-20 items-center justify-center">{img ? <img src={img} alt="Chữ ký" className="max-h-20" /> : null}</div>
      <div>{name}</div>
      {note && <div className="text-[10px] text-gray-500">{note}</div>}
    </div>
  );
}
