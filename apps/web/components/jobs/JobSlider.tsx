'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { SliderJob } from '@/lib/job-detail';
import { PROGRAM_LABEL, cx, formatYen } from '@/lib/format';
import Avatar from '../ui/Avatar';
import { IconArrowRight, IconCalendar, IconChevronLeft, IconChevronRight, IconPin, IconStar, IconUser } from '../ui/Icons';
import './job-slider.css';

const PER_VIEW = 4;
const BADGE_LABEL = { new: 'Tin mới', hot: 'Hot', urgent: 'Gấp' } as const;

interface JobSliderProps {
  title: string;
  jobs: SliderJob[];
  viewAllHref?: string;
  className?: string;
}

/** Slider đơn hàng: hiển thị 4 đơn, trượt từng đơn (không tự chạy) */
export default function JobSlider({ title, jobs, viewAllHref = '/tim-kiem', className }: JobSliderProps) {
  const items = jobs.slice(0, 8);
  const max = Math.max(0, items.length - PER_VIEW);
  const [index, setIndex] = useState(0);
  const pos = Math.min(index, max);

  return (
    <section className={cx('job-slider', className)}>
      <div className="container job-slider__inner">
        <div className="job-slider__head">
          <h2 className="job-slider__title">{title}</h2>
          <div className="job-slider__controls">
            <Link href={viewAllHref} className="job-slider__all">
              <span>Xem tất cả</span>
              <IconArrowRight size={16} className="icon--w22" />
            </Link>
            <button type="button" className="slider-btn" aria-label="Đơn trước" disabled={pos === 0} onClick={() => setIndex(Math.max(0, pos - 1))}>
              <IconChevronLeft size={18} className="icon--w22" />
            </button>
            <button type="button" className="slider-btn" aria-label="Đơn tiếp theo" disabled={pos === max} onClick={() => setIndex(pos >= max ? 0 : pos + 1)}>
              <IconChevronRight size={18} className="icon--w22" />
            </button>
          </div>
        </div>

        <div className="job-slider__viewport" aria-roledescription="carousel" aria-label={title}>
          <div className={cx('job-slider__track', `job-slider__track--pos-${pos}`)}>
            {items.map((job) => (
              <article key={job.href + job.title} className="slide-card">
                <Link href={job.href} className="slide-card__media">
                  <img className="slide-card__img" src={job.img} alt="" loading="lazy" />
                  <span className="slide-card__shade" />
                  <span className={cx('badge', `badge--${job.badge}`, 'slide-card__badge')}>{BADGE_LABEL[job.badge]}</span>
                  <span className="slide-card__pref">
                    <IconPin size={13} className="icon--w22" />
                    {job.pref}, Nhật Bản
                  </span>
                </Link>
                <div className="slide-card__body">
                  <span className="chip chip--program slide-card__program">{PROGRAM_LABEL[job.program]}</span>
                  <Link href={job.href} className="slide-card__title">
                    {job.title}
                  </Link>
                  <div className="slide-card__salary">
                    <span className="slide-card__salary-label">Lương cơ bản</span>
                    <span className="slide-card__salary-value">{formatYen(job.salary)}/tháng</span>
                  </div>
                  <div className="slide-card__facts">
                    <span>
                      <IconUser size={13} />
                      {job.qty}
                    </span>
                    <span>
                      <IconCalendar size={13} />
                      {job.age}
                    </span>
                  </div>
                  <div className="slide-card__foot">
                    <Avatar src={job.poster.photo} size={32} />
                    <span className="slide-card__poster">
                      <span className="slide-card__poster-name">{job.poster.name}</span>
                      <span className="slide-card__posted">{job.posted}</span>
                    </span>
                    <span className="slide-card__rating">
                      <IconStar size={12} className="slide-card__star" />
                      {job.poster.rating.toFixed(1)}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="job-slider__dots">
          {Array.from({ length: max + 1 }, (_, k) => (
            <button
              key={k}
              type="button"
              className={cx('job-slider__dot', k === pos && 'job-slider__dot--active')}
              aria-label={`Chuyển tới nhóm đơn ${k + 1}`}
              aria-current={k === pos}
              onClick={() => setIndex(k)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
