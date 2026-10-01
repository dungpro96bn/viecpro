import type { Metadata } from 'next';
import localFont from 'next/font/local';
import ApplyProvider from '@/components/apply/ApplyProvider';
import AuthProvider from '@/components/auth/AuthProvider';
import './globals.css';

const inter = localFont({
  src: '../public/fonts/InterVariable.woff2',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'viecpro – Việc làm Nhật Bản',
    template: '%s | viecpro',
  },
  description: 'Nền tảng việc làm Nhật Bản minh bạch cho người lao động Việt Nam: thực tập sinh, kỹ năng đặc định và kỹ sư.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        <AuthProvider>
          <ApplyProvider>{children}</ApplyProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
