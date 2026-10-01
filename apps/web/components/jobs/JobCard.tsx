import Link from 'next/link';
import type { ApplyJob, Job, Poster } from '@/lib/types';
import { PROGRAM_LABEL, TAG_CLASS, cx, formatNumber, formatYen } from '@/lib/format';
import { jobHref } from '@/lib/data';
import ApplyButton from '../apply/ApplyButton';
import Avatar from '../ui/Avatar';
import JobBadges from '../ui/JobBadges';
import SaveButton from '../ui/SaveButton';
import Stars from '../ui/Stars';
import { IconClock, IconEye, IconPhoneApp, IconPin, IconShieldCheck, IconZaloApp } from '../ui/Icons';
import './job-card.css';

interface BaseProps {
  job: Job;
  applyJob: ApplyJob;
}

interface FeedProps extends BaseProps {
  /** Card đầy đủ: trang chủ, trang tìm kiếm */
  variant?: 'feed';
  poster: Poster;
}

interface CompactProps extends BaseProps {
  /** Card gọn: trang hồ sơ nhà tuyển dụng */
  variant: 'compact';
  footer: { avatar?: string; prefix: string; name: string; meta: string[] };
}

type JobCardProps = FeedProps | CompactProps;

export default function JobCard(props: JobCardProps) {
  const { job, applyJob } = props;
  const compact = props.variant === 'compact';
  const href = jobHref(job);

  return (
    <article className={cx('job-card', compact && 'job-card--compact')}>
      <div className="job-card__body">
        <Link href={href} className="job-card__media" aria-label={job.title}>
          <img className="job-card__photo" src={job.img} alt="" loading="lazy" />
          <span className="job-card__shade" />
          <span className="job-card__pref">
            <IconPin size={14} className="icon--w22" />
            {job.pref}, Nhật Bản
          </span>
        </Link>

        <div className="job-card__content">
          <div className="job-card__top">
            <div className="job-card__heading">
              <JobBadges badges={job.badges} />
              <Link href={href} className="job-card__title">
                {job.title}
              </Link>
            </div>
            <div className="job-card__tools">
              {!compact && (
                <span className="job-card__views">
                  <IconEye size={15} />
                  {formatNumber(job.views)}
                </span>
              )}
              <SaveButton jobId={job.slug} initialSaved={job.saved} />
            </div>
          </div>

          <div className="job-card__chips">
            <span className="chip chip--program">{PROGRAM_LABEL[job.program]}</span>
            {job.tags.map((t) => (
              <span key={t} className={cx('chip', TAG_CLASS[t])}>
                {t}
              </span>
            ))}
          </div>

          <div className="job-card__stats-row">
            <div className="job-card__stats">
              <span className="job-card__stat">
                <span>Lương cơ bản</span>
                <span className="job-card__stat-value job-card__stat-value--salary">
                  {formatYen(job.salary)}
                  <span className="job-card__per">/tháng</span>
                </span>
              </span>
              <span className="job-card__stat">
                <span>Số lượng</span>
                <span className="job-card__stat-value">{job.qty}</span>
              </span>
              <span className="job-card__stat">
                <span>Năm sinh</span>
                <span className="job-card__stat-value">{job.age}</span>
              </span>
            </div>
            {compact && (
              <ApplyButton job={applyJob} className="btn btn--primary btn--sm">
                Ứng tuyển
              </ApplyButton>
            )}
          </div>
        </div>
      </div>

      {props.variant === 'compact' ? (
        <div className="job-card__footer job-card__footer--compact">
          <span className="job-card__owner">
            <Avatar src={props.footer.avatar} size={26} />
            <span>
              {props.footer.prefix} <b className="job-card__owner-name">{props.footer.name}</b>
            </span>
          </span>
          <span className="job-card__meta">
            {props.footer.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </span>
        </div>
      ) : (
        <FeedFooter poster={props.poster} posted={job.posted} applyJob={applyJob} />
      )}
    </article>
  );
}

function FeedFooter({ poster, posted, applyJob }: { poster: Poster; posted: string; applyJob: ApplyJob }) {
  const profileHref = poster.href ?? '#';
  return (
    <div className="job-card__footer">
      <div className="job-card__poster">
        <Link href={profileHref} aria-label={`Hồ sơ ${poster.name}`}>
          <Avatar src={poster.photo} size={44} verified />
        </Link>
        <div className="job-card__poster-info">
          <div className="job-card__poster-line">
            <Link href={profileHref} className="job-card__poster-name">
              {poster.name}
            </Link>
            <span className="job-card__poster-role">· {poster.role}</span>
          </div>
          <div className="job-card__poster-line job-card__poster-line--muted">
            <Stars rating={poster.rating} />
            <span className="job-card__rating">{poster.rating.toFixed(1)}</span>
            <span className="job-card__verified">
              · <IconShieldCheck size={13} className="icon--w22 job-card__verified-icon" />
              NTD xác thực
            </span>
          </div>
        </div>
        <span className="job-card__divider" />
        <div className="job-card__where">
          <span>
            <IconPin size={13} className="icon--w2" />
            {poster.city}
          </span>
          <span>
            <IconClock size={13} className="icon--w2" />
            {posted}
          </span>
        </div>
      </div>

      <div className="job-card__actions">
        <ApplyButton job={applyJob} />
        <a className="icon-btn" href="tel:19006688" aria-label={`Gọi cho ${poster.name}`}>
          <IconPhoneApp size={26} />
        </a>
        <a className="icon-btn" href="#" aria-label={`Nhắn Zalo với ${poster.name}`}>
          <IconZaloApp className="icon-btn__zalo" />
        </a>
      </div>
    </div>
  );
}
