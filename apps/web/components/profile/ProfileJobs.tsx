'use client';

import { useState } from 'react';
import Link from 'next/link';
import JobCard from '../jobs/JobCard';
import { IconArrowRight, IconBriefcaseLine } from '../ui/Icons';
import Select from '../ui/Select';
import { cx } from '@/lib/format';
import type { ApplyJob, Job, Program } from '@/lib/types';
import './profile.css';

export interface ProfileJobItem {
  job: Job;
  applyJob: ApplyJob;
  footer: { avatar?: string; prefix: string; name: string; meta: string[] };
}

interface ProfileJobsProps {
  title: string;
  items: ProfileJobItem[];
  /** Tổng số đơn theo từng chương trình (chỉ hiện tab có trong object) */
  totals: Partial<Record<'all' | Program, number>>;
  /** Chú thích sau "Đang hiển thị x / y đơn · …" */
  caption: string;
  viewAllLabel: string;
}

const TAB_LABEL: Record<'all' | Program, string> = { all: 'Tất cả', tts: 'Thực tập sinh', tok: 'Kỹ năng đặc định', ks: 'Kỹ sư' };

/** Khối "Đơn hàng đang tuyển" trong trang hồ sơ, có tab lọc theo chương trình */
export default function ProfileJobs({ title, items, totals, caption, viewAllLabel }: ProfileJobsProps) {
  const [tab, setTab] = useState<'all' | Program>('all');
  const tabs = (Object.keys(TAB_LABEL) as Array<'all' | Program>).filter((k) => totals[k] !== undefined);
  const shown = items.filter((i) => tab === 'all' || i.job.program === tab);

  return (
    <section id="don-hang" className="content-card">
      <div className="content-card__head content-card__head--between">
        <div className="content-card__head">
          <span className="content-card__icon">
            <IconBriefcaseLine size={19} />
          </span>
          <div className="content-card__titles">
            <h2 className="content-card__title">{title}</h2>
            <span className="content-card__subtitle">
              Đang hiển thị {shown.length} / {totals[tab]} đơn · {caption}
            </span>
          </div>
        </div>
        <Select className="field-input field-input--select sort-select__control" aria-label="Sắp xếp" options={['Mới nhất', 'Lương cao nhất', 'Xuất cảnh sớm nhất']} />
      </div>

      <div className="pill-tabs pill-tabs--sm" role="tablist" aria-label="Lọc theo chương trình">
        {tabs.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} className={cx('pill-tab', tab === k && 'pill-tab--active')} onClick={() => setTab(k)}>
            <span>{TAB_LABEL[k]}</span>
            <span className="count-pill">{totals[k]}</span>
          </button>
        ))}
      </div>

      <div className="job-list">
        {shown.map((i) => (
          <JobCard key={i.job.id + i.job.title} variant="compact" job={i.job} applyJob={i.applyJob} footer={i.footer} />
        ))}
      </div>

      <Link href="/tim-kiem" className="profile-view-all">
        {viewAllLabel}
        <IconArrowRight size={17} className="icon--w22" />
      </Link>
    </section>
  );
}
