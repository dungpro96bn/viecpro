'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

export default function MockPaymentPage() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');
  const [returnPath, setReturnPath] = useState('/quan-ly-tuyen-dung/goi-dich-vu');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRef(params.get('ref') ?? '');
    const requestedReturn = params.get('return');
    if (requestedReturn?.startsWith('/') && !requestedReturn.startsWith('//')) setReturnPath(requestedReturn);
  }, []);

  const finish = async (status: 'paid' | 'failed') => {
    setBusy(true);
    setError('');
    try {
      await apiRequest('/payments/mock/settle', { method: 'POST', body: JSON.stringify({ providerRef: ref, status }) });
      window.location.assign(returnPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cập nhật thanh toán.');
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 520, margin: '10vh auto', padding: 28, border: '1px solid #e4e7ec', borderRadius: 18, fontFamily: 'sans-serif' }}>
      <p>VieCPro · Mô phỏng thanh toán</p>
      <h1>Đơn {ref}</h1>
      <p>Đây là trang mô phỏng chỉ dành cho môi trường phát triển.</p>
      {error && <p role="alert">{error}</p>}
      <div style={{ display: 'flex', gap: 12 }}>
        <button disabled={busy || !ref} onClick={() => void finish('paid')}>Thanh toán thành công</button>
        <button disabled={busy || !ref} onClick={() => void finish('failed')}>Thất bại</button>
      </div>
    </main>
  );
}
