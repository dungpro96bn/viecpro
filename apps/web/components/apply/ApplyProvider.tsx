'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ApplyJob } from '@/lib/types';
import ApplyModal from './ApplyModal';

interface ApplyContextValue {
  openApply: (job: ApplyJob) => void;
  closeApply: () => void;
}

const ApplyContext = createContext<ApplyContextValue | null>(null);

/** Bọc toàn bộ ứng dụng để mọi nút "Ứng tuyển" mở chung một popup */
export default function ApplyProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<ApplyJob | null>(null);

  const openApply = useCallback((j: ApplyJob) => setJob(j), []);
  const closeApply = useCallback(() => setJob(null), []);
  const value = useMemo(() => ({ openApply, closeApply }), [openApply, closeApply]);

  return (
    <ApplyContext.Provider value={value}>
      {children}
      {job && <ApplyModal job={job} onClose={closeApply} />}
    </ApplyContext.Provider>
  );
}

export function useApply(): ApplyContextValue {
  const ctx = useContext(ApplyContext);
  if (!ctx) throw new Error('useApply phải được dùng bên trong <ApplyProvider>');
  return ctx;
}
