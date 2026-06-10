import type { JSX } from "solid-js";

import { cn } from "../../lib/utils";

type IconProps = JSX.SvgSVGAttributes<SVGSVGElement> & {
  name: string;
  title?: string;
};

const icons: Record<string, () => JSX.Element> = {
  add: () => (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  arrow_forward: () => (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  auto_stories: () => (
    <>
      <path d="M4 19.5V6.5A2.5 2.5 0 0 1 6.5 4H11v15H6.5A2.5 2.5 0 0 0 4 21.5" />
      <path d="M20 19.5V6.5A2.5 2.5 0 0 0 17.5 4H13v15h4.5A2.5 2.5 0 0 1 20 21.5" />
    </>
  ),
  bug_report: () => (
    <>
      <path d="M8 6.5 6.5 5" />
      <path d="M16 6.5 17.5 5" />
      <path d="M8 11h8" />
      <path d="M8 15h8" />
      <path d="M4 13h3" />
      <path d="M17 13h3" />
      <path d="M7 18a5 5 0 0 0 10 0V9a5 5 0 0 0-10 0z" />
      <path d="M10 5V3h4v2" />
    </>
  ),
  category: () => (
    <>
      <path d="M4 4h6v6H4z" />
      <path d="M14 4h6v6h-6z" />
      <path d="M4 14h6v6H4z" />
      <path d="M14 14h6v6h-6z" />
    </>
  ),
  check: () => <path d="m5 12 4 4L19 6" />,
  close: () => (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
  dashboard: () => (
    <>
      <path d="M4 4h7v7H4z" />
      <path d="M13 4h7v4h-7z" />
      <path d="M13 10h7v10h-7z" />
      <path d="M4 13h7v7H4z" />
    </>
  ),
  edit: () => (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="m14 7 3 3" />
    </>
  ),
  expand_more: () => <path d="m6 9 6 6 6-6" />,
  fact_check: () => (
    <>
      <path d="M4 5h16v14H4z" />
      <path d="m7 9 1.5 1.5L11 8" />
      <path d="M13 9h4" />
      <path d="m7 14 1.5 1.5L11 13" />
      <path d="M13 14h4" />
    </>
  ),
  flag: () => (
    <>
      <path d="M5 21V4" />
      <path d="M5 5h12l-1.5 4L17 13H5" />
    </>
  ),
  group: () => (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  language: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18" />
      <path d="M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  local_library: () => (
    <>
      <path d="M4 19.5V6a2 2 0 0 1 2-2h5v16H6a2 2 0 0 0-2 2" />
      <path d="M20 19.5V6a2 2 0 0 0-2-2h-5v16h5a2 2 0 0 1 2 2" />
      <path d="M12 6v14" />
    </>
  ),
  lock: () => (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  logout: () => (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  menu_book: () => (
    <>
      <path d="M4 19.5V6.5A2.5 2.5 0 0 1 6.5 4H11v15H6.5A2.5 2.5 0 0 0 4 21.5" />
      <path d="M20 19.5V6.5A2.5 2.5 0 0 0 17.5 4H13v15h4.5A2.5 2.5 0 0 1 20 21.5" />
      <path d="M7 8h2" />
      <path d="M15 8h2" />
      <path d="M7 12h2" />
      <path d="M15 12h2" />
    </>
  ),
  open_in_new: () => (
    <>
      <path d="M14 4h6v6" />
      <path d="m10 14 10-10" />
      <path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5" />
    </>
  ),
  payments: () => (
    <>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
      <path d="M7 15h4" />
      <path d="M15 15h2" />
    </>
  ),
  pending_actions: () => (
    <>
      <path d="M8 3h8" />
      <path d="M9 3v3h6V3" />
      <rect x="5" y="6" width="14" height="15" rx="2" />
      <path d="M9 12h4" />
      <path d="M9 16h3" />
      <path d="m15 16 1.5 1.5L20 14" />
    </>
  ),
  play_circle: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 8 6 4-6 4z" />
    </>
  ),
  quiz: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a2.5 2.5 0 1 1 3.9 2.1c-.9.6-1.4 1.1-1.4 2.4" />
      <path d="M12 17h.01" />
    </>
  ),
  school: () => (
    <>
      <path d="m3 10 9-5 9 5-9 5z" />
      <path d="M7 12.5V17c3 2 7 2 10 0v-4.5" />
      <path d="M21 10v5" />
    </>
  ),
  settings: () => (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6 1" />
    </>
  ),
  task_alt: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  trending_up: () => (
    <>
      <path d="m3 17 6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </>
  ),
  workspace_premium: () => (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="m8.5 12.5-1 8 4.5-2.5 4.5 2.5-1-8" />
    </>
  ),
  mail: () => (
    <>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </>
  ),
  visibility: () => (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  visibility_off: () => (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </>
  ),
  person_add: () => (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </>
  ),
  compass: () => (
    <>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </>
  ),
  sun: () => (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </>
  ),
  moon: () => <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
};

export function Icon(props: IconProps) {
  const label = () => props["aria-label"] || props.title;
  const paths = () => (icons[props.name] ?? icons.category)();

  return (
    <svg
      aria-hidden={label() ? undefined : "true"}
      aria-label={label() || undefined}
      class={cn("inline-block h-[1em] w-[1em] shrink-0", props.class)}
      fill="none"
      role={label() ? "img" : undefined}
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      viewBox="0 0 24 24"
    >
      {paths()}
    </svg>
  );
}
