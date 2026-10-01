import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Icon nét 24x24 – màu theo currentColor, độ dày nét lấy từ class .icon / .icon--wNN */
function Stroke({ size = 18, className, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className={className ? `icon ${className}` : 'icon'} {...rest}>
      {children}
    </svg>
  );
}

const make = (d: string) => {
  const Icon = (p: IconProps) => (
    <Stroke {...p}>
      <path d={d} />
    </Stroke>
  );
  return Icon;
};

export const IconLogoMark = make('M5 7l5.5 11L19 5');
export const IconSearch = make('M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4');
export const IconGrid = make('M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z');
export const IconBars = make('M4 20V10M10 20V4M16 20v-7M22 20H2');
export const IconModeration = make('M4 4h16v12H5.2L4 17.2zM8 9h8M8 12h5');
export const IconShieldCheck = make('M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4');
export const IconWorkers = make('M9 11a4 4 0 100-8 4 4 0 000 8zM2.5 21c.6-3.8 3.3-6 6.5-6s5.9 2.2 6.5 6M16 3.5a4 4 0 010 7.5M18.5 15c1.8.8 2.8 2.8 3 6');
export const IconBriefcase = make('M3 7h18v13H3zM8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18');
export const IconFlag = make('M5 21V4h11l-2 4 2 4H5');
export const IconWallet = make('M3 7h18v10H3zM12 15a3 3 0 100-6 3 3 0 000 6zM6 10v.01M18 14v.01');
export const IconReceipt = make('M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6');
export const IconBook = make('M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19V5');
export const IconKey = make('M15 7a4 4 0 11-3.9 5H4v3H2v-5h9.1A4 4 0 0115 7z');
export const IconList = make('M4 6h16M4 12h10M4 18h7');
export const IconSettings = make('M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4');
export const IconLogout = make('M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3');
export const IconCalendar = make('M5 5h14a1.5 1.5 0 011.5 1.5V19A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V6.5A1.5 1.5 0 015 5zM3.5 10h17M8 3v4M16 3v4');
export const IconDownload = make('M12 4v12M7 11l5 5 5-5M5 20h14');
export const IconBell = make('M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0');
export const IconSparkle = make('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z');
export const IconClock = make('M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z');
export const IconRefresh = make('M20 7v5h-5M4 17v-5h5M5.5 9a7 7 0 0112-2L20 12M4 12l2.5 5a7 7 0 0012-2');
export const IconArrowUp = make('M12 19V5M5 12l7-7 7 7');
export const IconArrowRight = make('M5 12h14M13 6l6 6-6 6');
export const IconChevronRight = make('M9 6l6 6-6 6');
export const IconCheck = make('M5 12.5l4.5 4.5L19 7.5');
export const IconSend = make('M21.5 2.5L10.5 13.5M21.5 2.5l-7 19-4-8-8-4z');
export const IconAlert = make('M12 7v6M12 17v.01');
export const IconMenu = make('M4 7h16M4 12h16M4 17h16');
export const IconClose = make('M6 6l12 12M18 6L6 18');
export const IconLock = make('M7 10.5V8a5 5 0 0110 0v2.5M5 10.5h14v10H5z');
export const IconCopy = make('M9 9h11v11H9zM5 15H4V4h11v1');
