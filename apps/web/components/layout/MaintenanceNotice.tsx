'use client';

import { useEffect, useState } from 'react';

interface SiteSystem {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

/** Thông báo vận hành do admin bật trong Cài đặt hệ thống */
export default function MaintenanceNotice() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, '');
    void fetch(`${base}/site/system`, { cache: 'no-store' })
      .then((r) => (r.ok ? (r.json() as Promise<SiteSystem>) : null))
      .then((data) => setMessage(data?.maintenanceMode ? data.maintenanceMessage : ''))
      .catch(() => undefined);
  }, []);
  return message ? <div className="site-maintenance" role="status">{message}</div> : null;
}
