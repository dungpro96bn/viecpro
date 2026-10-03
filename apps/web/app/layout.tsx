import type { Metadata } from 'next';
import localFont from 'next/font/local';
import ApplyProvider from '@/components/apply/ApplyProvider';
import AuthProvider from '@/components/auth/AuthProvider';
import MaintenanceGate from '@/components/layout/MaintenanceGate';
import MaintenanceScreen from '@/components/layout/MaintenanceScreen';
import { getSiteSystem } from '@/lib/server-api';
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const system = await getSiteSystem();
  return (
    <html lang="vi" className={inter.variable} data-scroll-behavior="smooth">
      <body>
        {system?.maintenanceMode ? (
          <MaintenanceScreen system={system} />
        ) : (
          <MaintenanceGate initialSystem={system}>
            <AuthProvider>
              <ApplyProvider>{children}</ApplyProvider>
            </AuthProvider>
          </MaintenanceGate>
        )}
      </body>
    </html>
  );
}
