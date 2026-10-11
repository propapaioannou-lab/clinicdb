// Line icons from the approved mockups (design/*.dc.html).
type P = { size?: number; className?: string };
const base = (size: number, className?: string) => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, className,
});

export const HomeIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></svg>
);
export const PatientsIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><path d="M16 4.5a3.5 3.5 0 010 7" /><path d="M18 14.2c2.1.7 3.5 2.8 3.5 5.8" /></svg>
);
export const CalendarIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
);
export const ScalpelIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><path d="M14.5 4l5.5 5.5-9 9H5.5V13z" /><path d="M12.5 6l5.5 5.5" /></svg>
);
export const TasksIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><path d="M9 11l2.5 2.5L16 9" /><rect x="3" y="3" width="18" height="18" rx="3" /></svg>
);
export const SettingsIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
);
export const SearchIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const ChatIcon = ({ size = 19, className }: P) => (
  <svg {...base(size, className)}><path d="M4 5h16v11H9l-5 4z" /></svg>
);
export const PlusIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)} strokeWidth={2.2}><path d="M12 5v14M5 12h14" /></svg>
);
export const LogoutIcon = ({ size = 18, className }: P) => (
  <svg {...base(size, className)}><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></svg>
);
