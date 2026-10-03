'use client';

import { useCallback, useEffect, useState } from 'react';
import type { EmployerReviewItem, EmployerReviewList } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import { formatNumber } from '@/lib/format';

export default function ReviewsView() {
  const [data, setData] = useState<EmployerReviewList | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setBusy(true);
    return apiRequest<EmployerReviewList>(`/employer/reviews?page=${page}&limit=20`)
      .then((result) => (setData(result), setError('')))
      .catch((cause: unknown) => setError(apiMessage(cause, 'Không tải được danh sách đánh giá.')))
      .finally(() => setBusy(false));
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="erv">
      <header className="emp-page-head"><span className="emp-page-head__titles"><span className="emp-page-head__eyebrow">Phản hồi từ người lao động</span><h1 className="emp-page-head__title">Đánh giá</h1></span></header>
      <p className="erv__intro">Đánh giá chỉ được gửi từ hồ sơ có ghi nhận xuất cảnh qua viecpro. Tên và thông tin liên hệ người đánh giá không hiển thị.</p>
      {error && <p className="erv__error" role="alert">{error}</p>}
      {!data && !error && <p className="emp-state" role="status">Đang tải đánh giá…</p>}
      {data && <>
        <section className="erv-summary" aria-label="Tổng quan đánh giá">
          <article className="emp-card erv-summary__score"><b>{data.average.toFixed(1)}</b><span aria-label={`${data.average.toFixed(1)} trên 5 sao`}>★★★★★</span><small>{formatNumber(data.total)} đánh giá</small></article>
          <article className="emp-card erv-summary__distribution">
            {data.distribution.map((row) => <div className="erv-bar" key={row.rating}><span>{row.rating} sao</span><span className="erv-bar__track"><i style={{ width: `${data.total ? (row.count / data.total) * 100 : 0}%` }} /></span><b>{formatNumber(row.count)}</b></div>)}
          </article>
          <article className="emp-card erv-summary__waiting"><b>{formatNumber(data.awaitingResponse)}</b><span>Chưa phản hồi</span></article>
        </section>
        <section className="erv-list" aria-label="Các đánh giá" aria-busy={busy}>
          {!data.items.length ? <div className="emp-card erv-empty"><b>Chưa có đánh giá</b><span>Đánh giá mới sẽ xuất hiện khi người lao động đã xuất cảnh chia sẻ trải nghiệm.</span></div> : data.items.map((item) => <ReviewCard key={item.id} item={item} onSaved={() => void load()} />)}
        </section>
        {data.total > data.limit && <nav className="erv-pages" aria-label="Trang đánh giá"><button type="button" className="btn btn--outline btn--sm" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>Trước</button><span>Trang {page} / {Math.ceil(data.total / data.limit)}</span><button type="button" className="btn btn--outline btn--sm" disabled={!data.hasMore} onClick={() => setPage((n) => n + 1)}>Tiếp</button></nav>}
      </>}
    </div>
  );
}

function ReviewCard({ item, onSaved }: { item: EmployerReviewItem; onSaved: () => void }) {
  const [response, setResponse] = useState(item.response ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return <article className="emp-card erv-card">
    <header className="erv-card__head"><span><b className="erv-card__stars" aria-label={`${item.rating} trên 5 sao`}>{'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}</b><small>Người lao động đã xuất cảnh · {new Date(item.createdAt).toLocaleDateString('vi-VN')}</small></span><span className="erv-card__recruiter">Cán bộ: {item.recruiterName}</span></header>
    <p className="erv-card__comment">{item.comment}</p>
    {item.response && <div className="erv-card__old-response"><b>Phản hồi hiện tại</b><p>{item.response}</p></div>}
    <form className="erv-reply" noValidate onSubmit={async (event) => {
      event.preventDefault();
      if (response.trim().length < 3) return setError('Phản hồi cần ít nhất 3 ký tự.');
      setBusy(true); setError('');
      try {
        await apiRequest(`/employer/reviews/${encodeURIComponent(item.id)}/respond`, { method: 'POST', body: JSON.stringify({ response }) });
        onSaved();
      } catch (cause) { setError(apiMessage(cause, 'Chưa lưu được phản hồi.')); }
      finally { setBusy(false); }
    }}>
      <label htmlFor={`response-${item.id}`}>{item.response ? 'Cập nhật phản hồi' : 'Phản hồi đánh giá'}</label>
      <textarea id={`response-${item.id}`} value={response} maxLength={1500} rows={3} onChange={(event) => (setResponse(event.target.value), setError(''))} placeholder="Viết lời cảm ơn hoặc làm rõ vấn đề…" />
      {error && <small className="erv-reply__error" role="alert">{error}</small>}
      <button type="submit" className="btn btn--outline btn--sm" disabled={busy}>{busy ? 'Đang lưu…' : item.response ? 'Cập nhật' : 'Gửi phản hồi'}</button>
    </form>
  </article>;
}
