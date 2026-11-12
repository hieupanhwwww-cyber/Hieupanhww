import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

const font = Be_Vietnam_Pro({
  variable: '--font-app',
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'HL Bán Hàng',
  description: 'Quản lý bán hàng – Nội Thất Hùng Loan',
};

export const viewport: Viewport = { themeColor: '#8b5e3c', viewportFit: 'cover' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={`${font.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
