import type { SVGProps } from 'react';

/** Line icons in the spirit of SF Symbols. 24×24, stroke = currentColor. */
const paths = {
  home: (
    <>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9v10.5h4.5v-6h4v6h4.5V9" />
    </>
  ),
  history: (
    <>
      <path d="M8.5 6.5h12M8.5 12h12M8.5 17.5h12" />
      <circle cx="4.2" cy="6.5" r="1" fill="currentColor" />
      <circle cx="4.2" cy="12" r="1" fill="currentColor" />
      <circle cx="4.2" cy="17.5" r="1" fill="currentColor" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  stats: (
    <>
      <path d="M4 20h16" />
      <rect x="5.5" y="11" width="3" height="6" rx="1" />
      <rect x="10.5" y="6" width="3" height="11" rx="1" />
      <rect x="15.5" y="9" width="3" height="8" rx="1" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="8" cy="12" r="0.9" fill="currentColor" />
      <circle cx="12" cy="12" r="0.9" fill="currentColor" />
      <circle cx="16" cy="12" r="0.9" fill="currentColor" />
    </>
  ),
  fuel: (
    <>
      <path d="M5 20.5V5.5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v15" />
      <path d="M3.5 20.5h13" />
      <path d="M7.5 7h5v4h-5z" />
      <path d="M15 9.5h1.5a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 0 3 0V8l-2.5-2.5" />
    </>
  ),
  wrench: (
    <path d="M14.7 6.3a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.7-7.7a4 4 0 0 0-2-2zM14.7 6.3 17 4" />
  ),
  gauge: (
    <>
      <path d="M4.5 17a8.5 8.5 0 1 1 15 0" />
      <path d="m12 13 3.5-4" />
      <circle cx="12" cy="13.5" r="1.3" fill="currentColor" />
    </>
  ),
  car: (
    <>
      <path d="M5 16.5V12l2-5h10l2 5v4.5" />
      <path d="M3.5 12h17v4.5h-17z" />
      <circle cx="7.5" cy="16.5" r="1.8" />
      <circle cx="16.5" cy="16.5" r="1.8" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6" width="17" height="13" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <circle cx="16.5" cy="14" r="1" fill="currentColor" />
    </>
  ),
  chevronRight: <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />,
  chevronLeft: <path d="M14.5 5.5 8 12l6.5 6.5" />,
  chevronDown: <path d="m6 9.5 6 6 6-6" />,
  chevronUpDown: (
    <>
      <path d="m8 9 4-4 4 4" />
      <path d="m8 15 4 4 4-4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M9 6.5V4.5h6v2" />
      <path d="M6.5 6.5 7.5 20h9l1-13.5" />
      <path d="M10 10v6.5M14 10v6.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z" />
      <circle cx="12" cy="13.2" r="3.5" />
    </>
  ),
  photo: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="3.3" />
      <path d="M2.8 19.5a6.2 6.2 0 0 1 12.4 0" />
      <path d="M15.5 5.9a3.2 3.2 0 0 1 0 6.2M17.5 13.6a6 6 0 0 1 3.7 5.9" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" />
      <circle cx="12" cy="12" r="6.5" />
    </>
  ),
  share: (
    <>
      <path d="M12 3.5v11" />
      <path d="m8 7 4-3.5L16 7" />
      <path d="M7 10.5H5.5v9h13v-9H17" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m8 11.5 4 4 4-4" />
      <path d="M5 19.5h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5v-11" />
      <path d="m8 8 4-4 4 4" />
      <path d="M5 19.5h14" />
    </>
  ),
  cloudCheck: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18.5z" />
      <path d="m9.5 13.8 2 2 3.5-3.6" />
    </>
  ),
  cloudOff: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.5-9M10 6.3a6 6 0 0 1 7.9 4.7 3.8 3.8 0 0 1 1.7 6.6M17.5 18.5H9" />
      <path d="m4 4 16 16" />
    </>
  ),
  cloudArrow: (
    <>
      <path d="M7 18.5a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18.5z" />
      <path d="M12 16.5v-5M9.8 13.5 12 11.3l2.2 2.2" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 2.8 19.5h18.4z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17" r="0.9" fill="currentColor" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5" />
      <circle cx="12" cy="7.8" r="0.9" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m15 15 5 5" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6.5h16M7 12h10M10 17.5h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="15" rx="2.5" />
      <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
    </>
  ),
  tire: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5 5 6v5.5c0 4.5 3 7.8 7 9 4-1.2 7-4.5 7-9V6z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  receipt: (
    <>
      <path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  road: (
    <>
      <path d="M8 3.5 4.5 20.5M16 3.5l3.5 17" />
      <path d="M12 4v2.5M12 10v3M12 16.5v3.5" />
    </>
  ),
  parking: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="3.5" />
      <path d="M10 16.5v-9h3a2.6 2.6 0 0 1 0 5.2h-3" />
    </>
  ),
  droplet: <path d="M12 3.5S6 10 6 14.2a6 6 0 0 0 12 0C18 10 12 3.5 12 3.5z" />,
  hammer: (
    <>
      <path d="m13.5 9.5-8 8a1.8 1.8 0 0 0 2.5 2.5l8-8" />
      <path d="m12 6 3-3 6 6-3 3z" />
    </>
  ),
  ellipsis: (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5.5" />
      <path d="m6.5 11 5.5-5.5 5.5 5.5" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v13.5" />
      <path d="m6.5 13 5.5 5.5 5.5-5.5" />
    </>
  ),
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.5 4.5v4h-4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </>
  ),
  logout: (
    <>
      <path d="M14 4.5H6.5v15H14" />
      <path d="M10.5 12h10M17 8.5l3.5 3.5-3.5 3.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7 5.3 5.3" />
    </>
  ),
  paste: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1M9 10h6M9 13.5h6M9 17h3.5" />
    </>
  ),
  pencil: (
    <>
      <path d="m4.5 19.5 1-4L16 5a2.1 2.1 0 0 1 3 3L8.5 18.5z" />
      <path d="m14 7 3 3" />
    </>
  ),
  euro: (
    <>
      <path d="M17.5 6.3A6.5 6.5 0 1 0 17.5 17.7" />
      <path d="M4.5 10.5h9M4.5 13.5h9" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5zM18.5 15.5c.3 1.8 1 2.5 2.5 2.8-1.6.3-2.2 1-2.5 2.7-.3-1.7-1-2.4-2.5-2.7 1.6-.3 2.2-1 2.5-2.8z" />
  ),
  archive: (
    <>
      <rect x="3.5" y="4.5" width="17" height="4" rx="1" />
      <path d="M5 8.5v11h14v-11M10 12.5h4" />
    </>
  ),
} as const;

export type IconName = keyof typeof paths;

export function Icon({
  name,
  size = 22,
  strokeWidth = 1.9,
  title,
  ...rest
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  title?: string;
} & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}
