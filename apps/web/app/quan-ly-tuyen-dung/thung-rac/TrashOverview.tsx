'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TRASH_CATEGORIES, TRASH_RETENTION_DAYS, type TrashSummary } from '@viecpro/shared';
import { EMPLOYER_BASE } from '@/components/employer/EmployerShell';
import { IconBriefcaseLine, IconChevronRight, IconMembers, IconTrash } from '@/components/ui/Icons';
import { apiMessage, apiRequest } from '@/lib/api';
import TrashHeader from './TrashHeader';
import './trash.css';

const ICON = { jobs: IconBriefcaseLine, members: IconMembers } as const;

/** Thùng rác: mỗi loại dữ liệu xoá mềm một mục (tin tuyển dụng, thành viên – theo TRASH_CATEGORIES) */
export default function TrashOverview() {
  const [data, setData] = useState<TrashSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest<TrashSummary>('/employer/trash')
      .then(setData)
      .catch((e) => setError(apiMessage(e, 'Không mở được Thùng rác.')));
  }, []);

  return (
    <div className="tr">
      <TrashHeader />
      <p className="tr-note">
        <IconTrash size={16} />
        Dữ liệu đã xoá nằm ở đây {TRASH_RETENTION_DAYS} ngày để bạn khôi phục khi cần, sau đó hệ thống tự xoá vĩnh viễn. Xoá vĩnh viễn không hoàn tác được.
      </p>
      {error && (
        <div className="emp-state emp-state--error" role="alert">
          {error}
        </div>
      )}
      {data && (
        <ul className="tr-cats">
          {data.categories.map((c) => {
            const meta = TRASH_CATEGORIES.find((x) => x.key === c.key)!;
            const Icon = ICON[c.key];
            return (
              <li key={c.key}>
                <Link href={`${EMPLOYER_BASE}/thung-rac/${meta.path}`} className="emp-card tr-cat">
                  <span className="tr-cat__icon">
                    <Icon size={20} />
                  </span>
                  <span className="tr-cat__text">
                    <b>{c.label}</b>
                    <small>{c.count ? `${c.count} mục` : 'Trống'}</small>
                  </span>
                  <IconChevronRight size={18} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
