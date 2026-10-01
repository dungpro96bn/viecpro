'use client';

import { useEffect, useState } from 'react';

/** true khi footer chưa xuất hiện trên màn hình – dùng cho thanh hành động dính đáy (ẩn khi cuộn tới footer) */
export function useBeforeFooter() {
  const [before, setBefore] = useState(true);

  useEffect(() => {
    const footer = document.querySelector('.site-footer');
    let frame = 0;
    const update = () => {
      frame = 0;
      setBefore(!footer || footer.getBoundingClientRect().top >= window.innerHeight);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  return before;
}
