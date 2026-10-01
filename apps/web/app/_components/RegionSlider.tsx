'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';

interface RegionSliderProps {
  regions: Array<{ key: string; name: string }>;
  children: ReactNode;
}

/** Lưới thẻ vùng; trên mobile thành slider vuốt ngang kèm dot (dot ẩn trên tablet/desktop) */
export default function RegionSlider({ regions, children }: RegionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let frame = 0;

    // Thẻ nào có mép trái gần điểm snap nhất là thẻ đang xem
    const update = () => {
      frame = 0;
      const cards = Array.from(track.children) as HTMLElement[];
      if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) {
        setActive(cards.length - 1);
        return;
      }
      const start = track.getBoundingClientRect().left + parseFloat(getComputedStyle(track).paddingLeft);
      let best = 0;
      cards.forEach((c, i) => {
        if (Math.abs(c.getBoundingClientRect().left - start) < Math.abs(cards[best].getBoundingClientRect().left - start)) best = i;
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (i: number) => {
    const card = trackRef.current?.children[i] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  return (
    <>
      <div ref={trackRef} className="pref-directory__grid">
        {children}
      </div>
      <div className="region-dots">
        {regions.map((r, i) => (
          <button
            key={r.key}
            type="button"
            className={cx('region-dots__dot', `region-dots__dot--${r.key}`, i === active && 'region-dots__dot--active')}
            aria-label={`Xem vùng ${r.name}`}
            aria-current={i === active}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </>
  );
}
