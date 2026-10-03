'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { SystemSettings } from '@viecpro/shared';
import MaintenanceScreen from './MaintenanceScreen';

type SiteSystem = Pick<SystemSettings, 'supportPhone' | 'supportEmail' | 'maintenanceMode' | 'maintenanceMessage'>;
const REFRESH_MS = 30_000;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');

export default function MaintenanceGate({ initialSystem, children }: { initialSystem: SiteSystem | null; children: ReactNode }) {
  const [system, setSystem] = useState<SiteSystem | null>(initialSystem);

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail;
      setSystem((current) => ({
        supportPhone: current?.supportPhone ?? '19006688',
        supportEmail: current?.supportEmail ?? 'hotro@viecpro.vn',
        maintenanceMode: true,
        maintenanceMessage: detail?.message || current?.maintenanceMessage || 'ViecPro đang bảo trì. Vui lòng quay lại sau.',
      }));
    };
    window.addEventListener('viecpro:maintenance', update);

    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/site/system`, { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as SiteSystem;
        if (active) setSystem(next);
      } catch {
        // Giữ trạng thái hiện tại nếu API tạm thời không truy cập được.
      }
    };
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('viecpro:maintenance', update);
    };
  }, []);

  if (system?.maintenanceMode) return <MaintenanceScreen system={system} />;
  return <>{children}</>;
}
