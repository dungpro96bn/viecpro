'use client';

import { useEffect, useState } from 'react';
import type { PartnerApplicantItem, PartnerApplicantList, PartnerJobItem } from '@viecpro/shared';
import { apiMessage, apiRequest } from '@/lib/api';
import './partner-view.css';

type MobileScreen = 'jobs' | 'applications' | 'detail';

const STATUS: Record<string, string> = {
  draft: 'Bản nháp', pending: 'Chờ duyệt', open: 'Đang tuyển', paused: 'Tạm ẩn', closed: 'Đã đóng', rejected: 'Bị từ chối',
  submitted: 'Mới gửi', viewed: 'Đã xem', interview: 'Phỏng vấn', passed: 'Trúng tuyển', departed: 'Đã xuất cảnh', rejected_application: 'Không phù hợp', withdrawn: 'Đã rút',
};

export default function PartnerJobsView() {
  const [jobs, setJobs] = useState<PartnerJobItem[]>([]);
  const [applications, setApplications] = useState<PartnerApplicantItem[]>([]);
  const [selectedJob, setSelectedJob] = useState<PartnerJobItem | null>(null);
  const [selectedApplicant, setSelectedApplicant] = useState<PartnerApplicantItem | null>(null);
  const [mobileScreen, setMobileScreen] = useState<MobileScreen>('jobs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest<{ items: PartnerJobItem[] }>('/employer/partner-jobs?page=1&limit=50')
      .then((result) => { if (active) setJobs(result.items); })
      .catch((cause) => { if (active) setError(apiMessage(cause, 'Không tải được tin đối tác.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const openJob = async (job: PartnerJobItem) => {
    setSelectedJob(job);
    setSelectedApplicant(null);
    setReportMessage('');
    setMobileScreen('applications');
    setError('');
    try {
      const result = await apiRequest<PartnerApplicantList>(`/employer/partner-jobs/${encodeURIComponent(job.id)}/applications?page=1&limit=50`);
      setApplications(result.items);
    } catch (cause) {
      setError(apiMessage(cause, 'Không tải được hồ sơ ứng viên.'));
      setApplications([]);
    }
  };

  const openApplicant = async (item: PartnerApplicantItem) => {
    setSelectedApplicant(item);
    setMobileScreen('detail');
    try {
      const detail = await apiRequest<PartnerApplicantItem>(`/employer/partner-applications/${encodeURIComponent(item.id)}`);
      setSelectedApplicant(detail);
    } catch (cause) {
      setError(apiMessage(cause, 'Không tải được chi tiết hồ sơ.'));
    }
  };

  const requestHide = async () => {
    if (!selectedJob || busy) return;
    setBusy(true);
    setReportMessage('');
    try {
      await apiRequest(`/employer/partner-jobs/${encodeURIComponent(selectedJob.id)}/report`, { method: 'POST' });
      setReportMessage('Đã gửi đề nghị tới bộ phận kiểm duyệt.');
    } catch (cause) {
      setReportMessage(apiMessage(cause, 'Chưa gửi được đề nghị. Vui lòng thử lại.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={`pv page page--fluid pv--mobile-${mobileScreen}`}>
      <header className="emp-page-head pv-head">
        <div className="emp-page-head__titles">
          <span className="emp-page-head__eyebrow">GIÁM SÁT TIN TUYỂN DỤNG</span>
          <h1 className="emp-page-head__title">Tin đối tác</h1>
          <p className="pv-intro">Xem tin và hồ sơ của tư vấn viên cá nhân đang liên kết với công ty.</p>
        </div>
      </header>

      {error && <p className="pv-alert" role="alert">{error}</p>}
      <div className="pv-layout">
        <section className="pv-panel pv-jobs" aria-label="Danh sách tin đối tác">
          <div className="pv-panel__head"><div><h2>Tin đối tác</h2><span>{jobs.length} tin</span></div></div>
          {loading ? <p className="pv-empty">Đang tải tin…</p> : jobs.length ? jobs.map((job) => (
            <button key={job.id} type="button" className={`pv-job ${selectedJob?.id === job.id ? 'pv-job--active' : ''}`} onClick={() => void openJob(job)}>
              <span className="pv-job__title">{job.title}</span>
              <span className="pv-job__meta">{job.code} · {job.recruiter.name}</span>
              <span className="pv-job__bottom"><span className={`pv-status pv-status--${job.status}`}>{STATUS[job.status] ?? job.status}</span><span>{job.applications} hồ sơ</span></span>
            </button>
          )) : <p className="pv-empty">Chưa có tin từ tư vấn viên đang liên kết.</p>}
        </section>

        <section className="pv-panel pv-applications" aria-label="Hồ sơ ứng viên">
          {selectedJob ? <>
            <div className="pv-panel__head pv-panel__head--split">
              <div>
                <button type="button" className="pv-back pv-mobile-only" onClick={() => setMobileScreen('jobs')}>‹ Tin đối tác</button>
                <h2>{selectedJob.title}</h2>
                <span>{selectedJob.recruiter.name} · {applications.length} hồ sơ</span>
              </div>
              <button type="button" className="emp-btn pv-report" disabled={busy || selectedJob.status === 'draft' || selectedJob.status === 'pending'} onClick={() => void requestHide()}>
                {busy ? 'Đang gửi…' : 'Đề nghị tạm ẩn'}
              </button>
            </div>
            {reportMessage && <p className="pv-report-message" role="status">{reportMessage}</p>}
            {applications.length ? applications.map((app) => (
              <button key={app.id} type="button" className={`pv-applicant ${selectedApplicant?.id === app.id ? 'pv-applicant--active' : ''}`} onClick={() => void openApplicant(app)}>
                <span className="pv-applicant__name">{app.fullName}</span>
                <span className="pv-applicant__meta">{app.age} tuổi · {app.hometown ?? 'Chưa cập nhật quê quán'}</span>
                <span className="pv-applicant__bottom"><span className="pv-status">{STATUS[app.status] ?? app.status}</span><span>{app.phone}</span></span>
              </button>
            )) : <p className="pv-empty">Chọn một tin để xem hồ sơ ứng viên.</p>}
          </> : <p className="pv-empty">Chọn tin đối tác để xem hồ sơ ứng viên.</p>}
        </section>

        <aside className="pv-panel pv-detail" aria-label="Chi tiết hồ sơ">
          {selectedApplicant ? <>
            <div className="pv-panel__head">
              <button type="button" className="pv-back pv-mobile-only" onClick={() => setMobileScreen('applications')}>‹ Hồ sơ ứng viên</button>
              <h2>{selectedApplicant.fullName}</h2>
              <span>{STATUS[selectedApplicant.status] ?? selectedApplicant.status}</span>
            </div>
            <div className="pv-detail__fields">
              <span><b>Điện thoại</b>{selectedApplicant.phone}</span>
              <span><b>Email</b>{selectedApplicant.email ?? 'Chưa cung cấp'}</span>
              <span><b>Địa chỉ</b>{selectedApplicant.address ?? selectedApplicant.hometown ?? 'Chưa cập nhật'}</span>
            </div>
            {selectedApplicant.contactMasked && <p className="pv-mask-note">Thông tin liên hệ đầy đủ sẽ hiển thị khi ứng viên trúng tuyển.</p>}
          </> : <p className="pv-empty">Chọn hồ sơ để xem chi tiết.</p>}
        </aside>
      </div>
    </main>
  );
}
