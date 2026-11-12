import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'HL Bán Hàng – Nội Thất Hùng Loan',
    short_name: 'HL Bán Hàng',
    description: 'Quản lý bán hàng, kho và đơn nội thất',
    start_url: '/ban-hang',
    display: 'standalone',
    background_color: '#faf7f2',
    theme_color: '#8b5e3c',
    lang: 'vi',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
