'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WEB_LINKS, type ApplicationItem, type JobListItem, type NotificationItem, type Paginated } from '@viecpro/shared';
import { useSeekerAccount } from '@/components/seeker/SeekerAccountProvider';
import { apiMessage, apiRequest } from '@/lib/api';
import { apiJobToView, apiRecruiterToPoster } from '@/lib/api-mappers';
import ApplyButton from '@/components/apply/ApplyButton';
import { IconArrowRight, IconBell, IconBriefcase, IconCalendar, IconCheck, IconDocList, IconHeart, IconPin, IconPlus, IconUserRound } from '@/components/ui/Icons';
import { jobHref, toApplyJob } from '@/lib/data';
import { cx } from '@/lib/format';
import AccountSecurity from './AccountSecurity';

/** Trạng thái hồ sơ còn rút được (khớp kiểm tra ở API) */
const WITHDRAWABLE: string[] = ['submitted', 'viewed', 'interview'];

export default function CandidateAccountPage() {
  const { profile, dashboard } = useSeekerAccount();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [recommended, setRecommended] = useState<JobListItem[]>([]);
  const [savedJobs, setSavedJobs] = useState<JobListItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [nextApplications, nextRecommended, nextSaved, nextNotifications] = await Promise.all([
          apiRequest<Paginated<ApplicationItem>>('/me/applications?page=1&limit=5'),
          apiRequest<Paginated<JobListItem>>('/jobs/recommended?page=1&limit=3'),
          apiRequest<Paginated<JobListItem>>('/me/saved-jobs?page=1&limit=6'),
          apiRequest<Paginated<NotificationItem> & { unread: number }>('/me/notifications?page=1&limit=5'),
        ]);
        if (!active) return;
        setApplications(nextApplications.items);
        setRecommended(nextRecommended.items);
        setSavedJobs(nextSaved.items);
        setNotifications(nextNotifications.items);
        setUnreadNotifications(nextNotifications.unread);
      } catch {
        if (active) setLoadError('Không tải được dữ liệu tài khoản. Vui lòng tải lại trang.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  /** Rút hồ sơ: chỉ khi nhà tuyển dụng chưa có kết quả */
  const withdraw = async (application: ApplicationItem) => {
    if (withdrawing || !window.confirm(`Rút hồ sơ ứng tuyển "${application.job.title}"?`)) return;
    setWithdrawing(application.id);
    setActionError('');
    try {
      const updated = await apiRequest<ApplicationItem>(`/me/applications/${encodeURIComponent(application.id)}/withdraw`, { method: 'POST' });
      setApplications((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      setActionError(apiMessage(error, 'Không rút được hồ sơ. Vui lòng thử lại.'));
    } finally {
      setWithdrawing(null);
    }
  };

  /** Đánh dấu đã đọc (một thông báo hoặc tất cả) – lỗi không chặn việc mở liên kết */
  const markRead = (id?: string) => {
    const target = id ? notifications.find((n) => n.id === id) : null;
    if (id && (!target || target.readAt)) return;
    if (!id && unreadNotifications === 0) return;
    const now = new Date().toISOString();
    setNotifications((items) => items.map((n) => (!id || n.id === id ? { ...n, readAt: n.readAt ?? now } : n)));
    setUnreadNotifications((count) => (id ? Math.max(0, count - 1) : 0));
    void apiRequest<void>(id ? `/me/notifications/${encodeURIComponent(id)}/read` : '/me/notifications/read-all', { method: 'POST' }).catch(() => undefined);
  };

  const stats = useMemo(() => [
    { icon: IconBriefcase, value: String(dashboard.applications.total), label: 'Đơn đã ứng tuyển', note: `${dashboard.applications.updated} cập nhật trong 7 ngày`, tone: 'blue' },
    { icon: IconCalendar, value: dashboard.nextInterview ? '1' : '0', label: 'Lịch phỏng vấn', note: dashboard.nextInterview ? new Date(dashboard.nextInterview.at).toLocaleString('vi-VN') : 'Chưa có lịch phỏng vấn', tone: 'purple' },
    { icon: IconHeart, value: String(dashboard.saved.total), label: 'Việc đã lưu', note: `${dashboard.saved.expiringSoon} đơn sắp hết hạn`, tone: 'pink' },
    { icon: IconUserRound, value: String(dashboard.profileViews.last7Days), label: 'Lượt NTD xem hồ sơ', note: `${dashboard.profileViews.delta >= 0 ? '+' : ''}${dashboard.profileViews.delta} so với tuần trước`, tone: 'green' },
  ], [dashboard]);

  if (loading) return <div className="account-loading" role="status">Đang tải dữ liệu tài khoản…</div>;
  if (loadError) return <div className="account-loading" role="alert">{loadError}</div>;

  const recommendedJobs = recommended.map((item) => ({ source: item, job: apiJobToView(item), poster: apiRecruiterToPoster(item) }));
  const latestApplication = applications[0];
  const statusLabels: Record<string, string> = { submitted: 'Đã gửi', viewed: 'Đã xem', interview: 'Phỏng vấn', passed: 'Đạt', rejected: 'Không phù hợp', withdrawn: 'Đã rút' };
  return (
    <>
          <section className="account-overview" aria-label="Tổng quan tài khoản">
            <div className="account-welcome">
              <div>
                <span className="account-welcome__date">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                <h1>Chào {profile.name}, hôm nay có {dashboard.newMatchingJobs} đơn mới hợp với bạn</h1>
                <p>{[profile.gender === 'nu' ? 'Nữ' : profile.gender === 'nam' ? 'Nam' : '', profile.birthYear ? `${new Date().getFullYear() - profile.birthYear} tuổi` : '', ...profile.programs, ...profile.industries, ...profile.prefs].filter(Boolean).join(' · ') || 'Bổ sung hồ sơ để nhận gợi ý việc làm phù hợp hơn.'}</p>
              </div>
              <Link href="/tim-kiem" className="btn btn--primary btn--md">Xem {dashboard.newMatchingJobs} đơn mới<IconArrowRight size={16} /></Link>
            </div>

            <div className="account-stats" id="activity">
              {stats.map(({ icon: Icon, value, label, note, tone }) => (
                <article key={label} className="account-stat">
                  <span className={cx('account-stat__icon', `account-stat__icon--${tone}`)}><Icon size={20} /></span>
                  <span className="account-stat__value">{value}</span>
                  <span className="account-stat__label">{label}</span>
                  <span className={cx('account-stat__note', tone === 'green' && 'account-stat__note--positive')}>{note}</span>
                </article>
              ))}
            </div>

            <div className="account-overview-grid">
              <section className="account-panel account-application" id="application-status">
                <div className="account-panel__heading">
                  <span className="account-panel__title"><span className="account-panel__heading-icon account-panel__heading-icon--blue"><IconDocList size={18} /></span>Hồ sơ đang tiến triển</span>
                  <span className="account-application__count">{dashboard.applications.total} hồ sơ</span>
                </div>
                {latestApplication ? <>
                  <div className="account-application__job">
                    <img src={latestApplication.job.imageUrl} alt="" />
                    <span><b>{latestApplication.job.title}</b><small>{latestApplication.job.employerName ?? latestApplication.job.pref} · {latestApplication.job.salary.toLocaleString('vi-VN')} ¥/tháng</small></span>
                  </div>
                  <ol className="account-steps" aria-label="Trạng thái hồ sơ ứng tuyển">
                    {latestApplication.timeline.map((event, index) => (
                      <li key={`${event.status}-${event.createdAt}`} className={cx('account-steps__step--done', index === latestApplication.timeline.length - 1 && 'account-steps__step--current')}>
                        <span className="account-steps__marker">{index < latestApplication.timeline.length - 1 ? <IconCheck size={13} /> : index + 1}</span>
                        <span className="account-steps__label">{statusLabels[event.status] ?? event.status}</span>
                        <small>{new Date(event.createdAt).toLocaleDateString('vi-VN')}</small>
                      </li>
                    ))}
                  </ol>
                  <ul className="account-application__list">
                    {applications.map((application) => (
                      <li key={application.id}>
                        <Link href={jobHref(application.job)}>{application.job.title}</Link>
                        <span className={cx('account-application__status', `account-application__status--${application.status}`)}>{statusLabels[application.status] ?? application.status}</span>
                        {WITHDRAWABLE.includes(application.status) && (
                          <button type="button" className="account-application__withdraw" disabled={withdrawing === application.id} onClick={() => void withdraw(application)}>
                            {withdrawing === application.id ? 'Đang rút…' : 'Rút hồ sơ'}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {actionError && <p className="account-application__error" role="alert">{actionError}</p>}
                </> : <p className="account-empty">Bạn chưa ứng tuyển đơn hàng nào.</p>}
              </section>

              <section className="account-panel account-interview">
                <div className="account-panel__heading">
                  <span className="account-panel__title"><span className="account-panel__heading-icon account-panel__heading-icon--purple"><IconCalendar size={18} /></span>Lịch phỏng vấn</span>
                  <span className="account-interview__month">{dashboard.nextInterview ? new Date(dashboard.nextInterview.at).toLocaleDateString('vi-VN', { month: 'long' }) : 'Chưa có lịch'}</span>
                </div>
                {dashboard.nextInterview ? <div className="account-interview__details">
                  <span className="account-interview__day"><b>{new Date(dashboard.nextInterview.at).toLocaleDateString('vi-VN', { day: '2-digit' })}</b><small>{new Date(dashboard.nextInterview.at).toLocaleDateString('vi-VN', { month: 'short' })}</small></span>
                  <span className="account-interview__info"><b>{dashboard.nextInterview.jobTitle}</b><small>{new Date(dashboard.nextInterview.at).toLocaleString('vi-VN')}</small></span>
                </div> : <p className="account-empty">Lịch phỏng vấn sẽ xuất hiện tại đây khi nhà tuyển dụng cập nhật hồ sơ.</p>}
              </section>
            </div>

            <section className="account-panel account-completion" id="profile-completion">
              <div className="account-completion__summary">
                <span className="account-completion__ring"><b>{profile.completion}%</b></span>
                <span><b>Hồ sơ gần hoàn thiện</b><small>Hồ sơ đầy đủ được cán bộ ưu tiên gọi lại nhanh gấp 3 lần.</small></span>
              </div>
              <div className="account-completion__tasks">
                {profile.suggestions.map((task) => <Link key={task.key} className="account-task" href={WEB_LINKS.seekerProfile}><span className="account-task__icon"><IconPlus size={14} /></span><span className="account-task__title">{task.label}</span><b className="account-task__score">+{task.gain}%</b></Link>)}
              </div>
            </section>

            <AccountSecurity />

            <section className="account-recommendations" id="recommendations">
              <div className="account-recommendations__heading">
                <div><h2>Việc làm phù hợp nhất với bạn</h2><p>Xếp theo độ phù hợp với tuổi, giới tính, ngành và tỉnh bạn quan tâm</p></div>
                <Link href="/tim-kiem">Xem thêm<IconArrowRight size={15} /></Link>
              </div>
              <div className="account-job-grid">
                {recommendedJobs.map(({ source, job, poster }) => {
                  return (
                    <article key={job.id} className="account-job-card">
                      <Link href={jobHref(job)} className="account-job-card__media" aria-label={job.title}>
                        <img src={job.img} alt="" />
                        <span className="account-job-card__match">Phù hợp {source.matchScore ?? 0}%</span>
                        <span className="account-job-card__location"><IconPin size={13} />{job.pref}, Nhật Bản</span>
                      </Link>
                      <div className="account-job-card__body">
                        <Link href={jobHref(job)} className="account-job-card__title">{job.title}</Link>
                        <b className="account-job-card__salary">{job.salary.toLocaleString('vi-VN')} ¥<small>/tháng</small></b>
                        <div className="account-job-card__tags">{(source.matchReasons?.length ? source.matchReasons : source.tags).slice(0, 2).map((reason) => <span key={reason}>{reason}</span>)}</div>
                        <ApplyButton job={toApplyJob(job, undefined, poster)} className="btn btn--primary btn--md account-job-card__apply">Ứng tuyển 1 chạm</ApplyButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="account-recommendations" id="saved-jobs">
              <div className="account-recommendations__heading"><div><h2>Việc đã lưu</h2><p>{dashboard.saved.total} việc trong danh sách đã lưu</p></div><Link href="/tim-kiem">Tìm thêm<IconArrowRight size={15} /></Link></div>
              {savedJobs.length ? <div className="account-job-grid">{savedJobs.map((item) => { const job = apiJobToView(item); const poster = apiRecruiterToPoster(item); return <article key={job.id} className="account-job-card"><Link href={jobHref(job)} className="account-job-card__media"><img src={job.img} alt="" /><span className="account-job-card__location"><IconPin size={13} />{job.pref}, Nhật Bản</span></Link><div className="account-job-card__body"><Link href={jobHref(job)} className="account-job-card__title">{job.title}</Link><b className="account-job-card__salary">{job.salary.toLocaleString('vi-VN')} ¥<small>/tháng</small></b><ApplyButton job={toApplyJob(job, item.employer?.name, poster)} className="btn btn--primary btn--md account-job-card__apply">Ứng tuyển</ApplyButton></div></article>; })}</div> : <p className="account-empty">Bạn chưa lưu việc làm nào.</p>}
            </section>

            <section className="account-panel account-notifications" id="notifications">
              <div className="account-panel__heading"><span className="account-panel__title"><span className="account-panel__heading-icon account-panel__heading-icon--purple"><IconBell size={18} /></span>Thông báo mới</span><span className="account-notifications__tools">{unreadNotifications} chưa đọc{unreadNotifications > 0 && <button type="button" onClick={() => markRead()}>Đánh dấu đã đọc</button>}</span></div>
              {notifications.length ? <ul className="account-notifications__list">{notifications.map((notice) => <li key={notice.id} className={cx('account-notifications__item', !notice.readAt && 'account-notifications__item--unread')}><Link href={notice.link ?? '#notifications'} onClick={() => markRead(notice.id)}><b>{notice.title}</b>{notice.body && <span>{notice.body}</span>}<small>{new Date(notice.createdAt).toLocaleString('vi-VN')}</small></Link></li>)}</ul> : <p className="account-empty">Bạn chưa có thông báo nào.</p>}
            </section>
          </section>
    </>
  );
}
