'use client';

import { useEffect, useState } from 'react';

/** Giá trị trễ `ms` – dùng cho ô tìm kiếm để không gọi API mỗi lần gõ */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
