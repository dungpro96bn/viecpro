'use client';

import { useState, type FormEvent } from 'react';
import { apiRequest, apiMessage } from '@/lib/api';

export default function NewsletterForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      await apiRequest<void>('/leads/subscriptions', { method: 'POST', body: JSON.stringify({ contact: data.get('contact'), prefs: [], programs: [] }) });
      setMessage('Đã đăng ký nhận tin.');
      form.reset();
    } catch (cause) {
      setError(apiMessage(cause, 'Không đăng ký được. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return <form className="newsletter-form" noValidate onSubmit={(event) => void submit(event)}>
    <input type="text" name="contact" className="newsletter-form__input" aria-label="Email hoặc số điện thoại" placeholder="Email hoặc số điện thoại" required maxLength={254} />
    <button type="submit" className="btn btn--primary newsletter-form__btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Đăng ký'}</button>
    {(message || error) && <span className="newsletter-form__status" role={error ? 'alert' : 'status'}>{error || message}</span>}
  </form>;
}
