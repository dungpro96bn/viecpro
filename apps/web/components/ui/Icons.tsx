import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Icon nét (stroke) 24x24 – màu theo currentColor, độ dày nét lấy từ class .icon */
function StrokeIcon({ size = 18, className, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      className={className ? `icon ${className}` : 'icon'}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Icon đặc (fill) 24x24 */
function SolidIcon({ size = 18, className, children, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className} {...rest}>
      {children}
    </svg>
  );
}

/** Icon nét với path tuỳ ý (dùng cho dữ liệu có sẵn đường dẫn icon) */
export const PathIcon = ({ d, ...p }: IconProps & { d: string }) => (
  <StrokeIcon {...p}>
    <path d={d} />
  </StrokeIcon>
);

export const IconCheckMark = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M5 7l5.5 11L19 5" />
  </StrokeIcon>
);
export const IconSearch = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </StrokeIcon>
);
export const IconPin = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </StrokeIcon>
);
export const IconBriefcase = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
  </StrokeIcon>
);
export const IconBriefcaseLine = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18" />
  </StrokeIcon>
);
export const IconMap = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </StrokeIcon>
);
export const IconArrowRight = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </StrokeIcon>
);
export const IconArrowLeft = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </StrokeIcon>
);
export const IconChevronLeft = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M15 6l-6 6 6 6" />
  </StrokeIcon>
);
export const IconChevronDown = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 9l6 6 6-6" />
  </StrokeIcon>
);
export const IconChevronRight = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M9 6l6 6-6 6" />
  </StrokeIcon>
);
export const IconEye = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </StrokeIcon>
);
export const IconEyeOff = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A9.7 9.7 0 0112 5c6.4 0 10 7 10 7a17.6 17.6 0 01-3.2 4M6.6 6.6A17.4 17.4 0 002 12s3.6 7 10 7c2 0 3.8-.6 5.4-1.6" />
  </StrokeIcon>
);
export const IconHeart = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 20.3s-7.8-4.6-9.2-9.6C1.9 7.4 3.9 4.2 7.2 4.2c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.3 3.2 4.4 6.5-1.4 5-9.2 9.6-9.2 9.6z" />
  </StrokeIcon>
);
export const IconPhone = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />
  </StrokeIcon>
);
export const IconClock = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </StrokeIcon>
);
export const IconMail = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3.5 6l8.5 7 8.5-7" />
  </StrokeIcon>
);
export const IconCalendar = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </StrokeIcon>
);
export const IconUser = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
  </StrokeIcon>
);
export const IconUserRound = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" />
  </StrokeIcon>
);
export const IconTeam = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18.5 14.8c1.7.8 2.7 2.5 3 5.2" />
  </StrokeIcon>
);
export const IconBuilding = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M8 8h3M8 12h3M8 16h3M3 21h18" />
  </StrokeIcon>
);
export const IconBuildingSimple = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 21V5a1 1 0 011-1h9a1 1 0 011 1v16M15 9h4a1 1 0 011 1v11M3 21h18" />
  </StrokeIcon>
);
export const IconShieldCheck = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z" />
    <path d="M8.8 12.2l2.2 2.2 4.2-4.3" />
  </StrokeIcon>
);
export const IconShield = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z" />
  </StrokeIcon>
);
export const IconShieldPlus = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 3l7 3v5.5c0 4.3-3 7.9-7 9.5-4-1.6-7-5.2-7-9.5V6z" />
    <path d="M9.5 12h5M12 9.5v5" />
  </StrokeIcon>
);
export const IconCheck = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </StrokeIcon>
);
export const IconCheckCircle = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
  </StrokeIcon>
);
export const IconTaskCheck = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M9 11l3 3 8-8M20 12v6a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />
  </StrokeIcon>
);
export const IconBoltLine = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" />
  </StrokeIcon>
);
export const IconMinus = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 12h8" />
  </StrokeIcon>
);
export const IconPlus = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 5v14M5 12h14" />
  </StrokeIcon>
);
export const IconMenu = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </StrokeIcon>
);
export const IconClose = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </StrokeIcon>
);
export const IconCloseSmall = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M7 7l10 10M17 7L7 17" />
  </StrokeIcon>
);
export const IconSend = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M21.5 2.5L10.5 13.5M21.5 2.5l-7 19-4-8-8-4z" />
  </StrokeIcon>
);
export const IconLock = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V8a4 4 0 018 0v2.5" />
  </StrokeIcon>
);
export const IconShare = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </StrokeIcon>
);
export const IconTrendUp = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
  </StrokeIcon>
);
export const IconChat = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M21 12a8.5 8.5 0 01-12.5 7.5L3 21l1.5-5.5A8.5 8.5 0 1121 12z" />
  </StrokeIcon>
);
export const IconChatSquare = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 5h16v11H9l-5 4z" />
  </StrokeIcon>
);
export const IconWarning = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 3l9.5 17h-19z" />
    <path d="M12 10v4.5M12 17.5v.01" />
  </StrokeIcon>
);
export const IconFilter = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 5h18l-7 8.5V19l-4 2v-7.5z" />
  </StrokeIcon>
);
export const IconSliders = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </StrokeIcon>
);
export const IconDocList = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </StrokeIcon>
);
export const IconUserCheck = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="10" cy="8" r="4" />
    <path d="M3 20c.7-3.7 3.4-6 7-6 1.6 0 3 .4 4.1 1.2M15.5 18.5l2 2 4-4" />
  </StrokeIcon>
);
export const IconWallet = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18M7 15h3" />
  </StrokeIcon>
);
export const IconRoute = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 19l5-6 4 3 7-9" />
    <circle cx="4" cy="19" r="1.5" />
    <circle cx="20" cy="7" r="1.5" />
  </StrokeIcon>
);
export const IconGift = (p: IconProps) => (
  <StrokeIcon {...p}>
    <rect x="3.5" y="8" width="17" height="4" rx="1" />
    <path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1s3 1 5 1zM12 8c1.5-3 5-3.5 5-1s-3 1-5 1z" />
  </StrokeIcon>
);
export const IconTrophy = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4v1a3 3 0 003 3M17 6h3v1a3 3 0 01-3 3" />
  </StrokeIcon>
);
export const IconMedal = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="M8.5 13l-1.5 8 5-2.5 5 2.5-1.5-8" />
  </StrokeIcon>
);

/* ---------------- Icon đặc ---------------- */
export const IconStar = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
  </SolidIcon>
);
export const IconBell = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M12 1.5c.8 0 1.5.7 1.5 1.5v.8c3.3.7 5.5 3.6 5.5 7v1.3c0 1.9.7 3.8 2 5.2l.3.4c.5.5.3 1.3-.4 1.3H3.1c-.7 0-.9-.8-.4-1.3l.3-.4c1.3-1.4 2-3.3 2-5.2v-1.3c0-3.4 2.2-6.3 5.5-7V3c0-.8.7-1.5 1.5-1.5z" />
    <path d="M9.2 20.5h5.6a2.8 2.8 0 01-5.6 0z" />
  </SolidIcon>
);
export const IconFlame = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M12 22c-4.4 0-7.5-3-7.5-7.2 0-3.3 2-5.6 3.8-7.6.5 1.8 1.5 3 2.8 3.6C11 7 12.2 4.2 14.6 2c.4 3.2 2 5 3.4 6.8 1 1.4 1.5 3 1.5 5 0 4.6-3.2 8.2-7.5 8.2z" />
  </SolidIcon>
);
export const IconBolt = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M13.5 2L4.5 13.5h6L9.5 22l9-11.5h-6z" />
  </SolidIcon>
);
export const IconPersonSilhouette = (p: IconProps) => (
  <SolidIcon {...p}>
    <circle cx="12" cy="9" r="5" />
    <path d="M1.5 25c1-6.5 5-10 10.5-10s9.5 3.5 10.5 10z" />
  </SolidIcon>
);
export const IconFacebook = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M13.6 21v-7.6h2.6l.4-3.1h-3V8.4c0-.9.3-1.5 1.5-1.5h1.6V4.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.3H7.9v3.1h2.6V21z" />
  </SolidIcon>
);
export const IconYoutube = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M21.6 7.2a2.6 2.6 0 00-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.6 2.6 0 002.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.6 2.6 0 001.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.6 2.6 0 001.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />
  </SolidIcon>
);
export const IconTiktok = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M16.6 3h-3.3v12.2a2.7 2.7 0 11-2.7-2.7c.3 0 .6 0 .8.1V9.2a6 6 0 00-.8-.1 6 6 0 106 6V8.9a7.6 7.6 0 004.4 1.4V7a4.4 4.4 0 01-4.4-4z" />
  </SolidIcon>
);

/** Icon ứng dụng Điện thoại kiểu iPhone (bản màu) */
export const IconPhoneApp = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" fill="none" aria-hidden="true" className={className}>
    <defs>
      <linearGradient id="phone-app-bg" x1="25" y1="0" x2="25" y2="50" gradientUnits="userSpaceOnUse">
        <stop stopColor="#5DF777" />
        <stop offset="1" stopColor="#0ABD29" />
      </linearGradient>
    </defs>
    <path d="M22.782 0.166016H27.199C33.2653 0.166016 36.8103 1.05701 39.9572 2.74421C43.1041 4.4314 45.5875 6.89585 47.2557 10.0428C48.9429 13.1897 49.8339 16.7347 49.8339 22.801V27.1991C49.8339 33.2654 48.9429 36.8104 47.2557 39.9573C45.5685 43.1042 43.1041 45.5877 39.9572 47.2559C36.8103 48.9431 33.2653 49.8341 27.199 49.8341H22.8009C16.7346 49.8341 13.1896 48.9431 10.0427 47.2559C6.89583 45.5687 4.41243 43.1042 2.7442 39.9573C1.057 36.8104 0.166016 33.2654 0.166016 27.1991V22.801C0.166016 16.7347 1.057 13.1897 2.7442 10.0428C4.43139 6.89585 6.89583 4.41245 10.0427 2.74421C13.1707 1.05701 16.7346 0.166016 22.782 0.166016Z" fill="url(#phone-app-bg)" />
    <path
      transform="translate(10 10) scale(1.25)"
      d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
      fill="#FFFFFF"
    />
  </svg>
);

/** Logo ứng dụng Zalo (bản màu) */
export const IconZaloApp = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 50 50" fill="none" aria-hidden="true" className={className}>
    <path fillRule="evenodd" clipRule="evenodd" d="M22.782 0.166016H27.199C33.2653 0.166016 36.8103 1.05701 39.9572 2.74421C43.1041 4.4314 45.5875 6.89585 47.2557 10.0428C48.9429 13.1897 49.8339 16.7347 49.8339 22.801V27.1991C49.8339 33.2654 48.9429 36.8104 47.2557 39.9573C45.5685 43.1042 43.1041 45.5877 39.9572 47.2559C36.8103 48.9431 33.2653 49.8341 27.199 49.8341H22.8009C16.7346 49.8341 13.1896 48.9431 10.0427 47.2559C6.89583 45.5687 4.41243 43.1042 2.7442 39.9573C1.057 36.8104 0.166016 33.2654 0.166016 27.1991V22.801C0.166016 16.7347 1.057 13.1897 2.7442 10.0428C4.43139 6.89585 6.89583 4.41245 10.0427 2.74421C13.1707 1.05701 16.7346 0.166016 22.782 0.166016Z" fill="#0068FF" />
    <path opacity="0.12" fillRule="evenodd" clipRule="evenodd" d="M49.8336 26.4736V27.1994C49.8336 33.2657 48.9427 36.8107 47.2555 39.9576C45.5683 43.1045 43.1038 45.5879 39.9569 47.2562C36.81 48.9434 33.265 49.8344 27.1987 49.8344H22.8007C17.8369 49.8344 14.5612 49.2378 11.8104 48.0966L7.27539 43.4267L49.8336 26.4736Z" fill="#001A33" />
    <path fillRule="evenodd" clipRule="evenodd" d="M7.779 43.5892C10.1019 43.846 13.0061 43.1836 15.0682 42.1825C24.0225 47.1318 38.0197 46.8954 46.4923 41.4732C46.8209 40.9803 47.1279 40.4677 47.4128 39.9363C49.1062 36.7779 50.0004 33.22 50.0004 27.1316V22.7175C50.0004 16.629 49.1062 13.0711 47.4128 9.91273C45.7385 6.75436 43.2461 4.28093 40.0877 2.58758C36.9293 0.894239 33.3714 0 27.283 0H22.8499C17.6644 0 14.2982 0.652754 11.4699 1.89893C11.3153 2.03737 11.1636 2.17818 11.0151 2.32135C2.71734 10.3203 2.08658 27.6593 9.12279 37.0782C9.13064 37.0921 9.13933 37.1061 9.14889 37.1203C10.2334 38.7185 9.18694 41.5154 7.55068 43.1516C7.28431 43.399 7.37944 43.5512 7.779 43.5892Z" fill="#FFFFFF" />
    <path d="M20.5632 17H10.8382V19.0853H17.5869L10.9329 27.3317C10.7244 27.635 10.5728 27.9194 10.5728 28.5639V29.0947H19.748C20.203 29.0947 20.5822 28.7156 20.5822 28.2606V27.1421H13.4922L19.748 19.2938C19.8428 19.1801 20.0134 18.9716 20.0893 18.8768L20.1272 18.8199C20.4874 18.2891 20.5632 17.8341 20.5632 17.2844V17Z" fill="#0068FF" />
    <path d="M32.9416 29.0947H34.3255V17H32.2402V28.3933C32.2402 28.7725 32.5435 29.0947 32.9416 29.0947Z" fill="#0068FF" />
    <path d="M25.814 19.6924C23.1979 19.6924 21.0747 21.8156 21.0747 24.4317C21.0747 27.0478 23.1979 29.171 25.814 29.171C28.4301 29.171 30.5533 27.0478 30.5533 24.4317C30.5723 21.8156 28.4491 19.6924 25.814 19.6924ZM25.814 27.2184C24.2785 27.2184 23.0273 25.9672 23.0273 24.4317C23.0273 22.8962 24.2785 21.645 25.814 21.645C27.3495 21.645 28.6007 22.8962 28.6007 24.4317C28.6007 25.9672 27.3685 27.2184 25.814 27.2184Z" fill="#0068FF" />
    <path d="M40.4867 19.6162C37.8516 19.6162 35.7095 21.7584 35.7095 24.3934C35.7095 27.0285 37.8516 29.1707 40.4867 29.1707C43.1217 29.1707 45.2639 27.0285 45.2639 24.3934C45.2639 21.7584 43.1217 19.6162 40.4867 19.6162ZM40.4867 27.2181C38.9322 27.2181 37.681 25.9669 37.681 24.4124C37.681 22.8579 38.9322 21.6067 40.4867 21.6067C42.0412 21.6067 43.2924 22.8579 43.2924 24.4124C43.2924 25.9669 42.0412 27.2181 40.4867 27.2181Z" fill="#0068FF" />
    <path d="M29.4562 29.0944H30.5747V19.957H28.6221V28.2793C28.6221 28.7153 29.0012 29.0944 29.4562 29.0944Z" fill="#0068FF" />
  </svg>
);

/* ---------- Khu quản lý nhà tuyển dụng & tài khoản ứng viên ---------- */
export const IconHome = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />
  </StrokeIcon>
);

export const IconSettings = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
  </StrokeIcon>
);

export const IconHelp = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1.1-1.5 2.2M12 17v.01" />
  </StrokeIcon>
);

/** Chuông dạng nét (thanh trên khu quản lý) */
export const IconBellLine = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 003.4 0" />
  </StrokeIcon>
);

export const IconExternal = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />
  </StrokeIcon>
);

export const IconVideo = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 6h11v12H4zM15 10l5-3v10l-5-3" />
  </StrokeIcon>
);

/** Mũi tên lên / xuống (chọn tài khoản) */
export const IconSelector = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />
  </StrokeIcon>
);

export const IconBarChart = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </StrokeIcon>
);

/** Thành viên doanh nghiệp */
export const IconMembers = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M16 11a3 3 0 100-6M8 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2 20c.5-3.5 3-5.5 6-5.5s5.5 2 6 5.5M16 14.5c2.6.2 4.5 2 5 5.5" />
  </StrokeIcon>
);

/** Dấu chấm than nhỏ (cảnh báo nhẹ trong chip) */
export const IconExclaim = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 7v6M12 17v.01" />
  </StrokeIcon>
);

export const IconEdit = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />
  </StrokeIcon>
);

export const IconCamera = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
  </StrokeIcon>
);

export const IconDownload = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </StrokeIcon>
);

export const IconUpload = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </StrokeIcon>
);

/** Lấp lánh (gợi ý thông minh / AI) */
export const IconSparkle = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />
  </StrokeIcon>
);

export const IconLogout = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 17l5-5-5-5M15 12H3" />
  </StrokeIcon>
);

/** Lưu nháp */
export const IconSave = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7" />
  </StrokeIcon>
);

export const IconGraduation = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 9l9-5 9 5-9 5zM7 11.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5" />
  </StrokeIcon>
);

export const IconLink = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </StrokeIcon>
);

export const IconArrowUp = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 19V5M5 12l7-7 7 7" />
  </StrokeIcon>
);

export const IconChevronUp = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 15l6-6 6 6" />
  </StrokeIcon>
);

export const IconList = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </StrokeIcon>
);

/** Ứng viên vắng mặt */
export const IconUserOff = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M3 3l18 18M9 11a4 4 0 004.9 3.9M16 3.5a4 4 0 01-1 7.4M2.5 21c.6-3.8 3.3-6 6.5-6" />
  </StrokeIcon>
);

export const IconFile = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 3h8l5 5v13H6zM14 3v5h5" />
  </StrokeIcon>
);

/** Tệp Excel */
export const IconFileSheet = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M6 3h8l5 5v13H6zM14 3v5h5M9 13l4 5M13 13l-4 5" />
  </StrokeIcon>
);

export const IconPlay = (p: IconProps) => (
  <SolidIcon {...p}>
    <path d="M8 5.5v13l11-6.5z" />
  </SolidIcon>
);

/** Ngôi sao dạng nét (menu "Đánh giá") */
export const IconStarLine = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z" />
  </StrokeIcon>
);

/** Mục tiêu – "gợi ý phù hợp" (spec R8, thay cho icon sao "AI") */
export const IconTarget = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="1" />
  </StrokeIcon>
);
export const IconTrash = (p: IconProps) => (
  <StrokeIcon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12M9 7V4h6v3" />
  </StrokeIcon>
);
/** Ngôn ngữ / quả địa cầu (Cài đặt) */
export const IconGlobe = (p: IconProps) => (
  <StrokeIcon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
  </StrokeIcon>
);
/** Dữ liệu / cơ sở dữ liệu (Cài đặt – tải dữ liệu, xoá tài khoản) */
export const IconDatabase = (p: IconProps) => (
  <StrokeIcon {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8v-13M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" />
  </StrokeIcon>
);
