import type { BadgeKind } from '@/lib/types';
import { IconBell, IconBolt, IconFlame } from './Icons';

const LABEL: Record<BadgeKind, string> = { new: 'Tin mới', hot: 'Hot', urgent: 'Gấp' };

/** Nhãn trạng thái tin tuyển dụng: Tin mới (#3879FF) / Hot (#BF2A1D) / Gấp (#EB7D10) */
export default function JobBadges({ badges }: { badges: BadgeKind[] }) {
  if (!badges.length) return null;
  return (
    <div className="job-badges">
      {badges.map((b) => (
        <span key={b} className={`badge badge--${b}`}>
          {b === 'new' && <IconBell size={11} />}
          {b === 'hot' && <IconFlame size={11} />}
          {b === 'urgent' && <IconBolt size={11} />}
          <span>{LABEL[b]}</span>
        </span>
      ))}
    </div>
  );
}
