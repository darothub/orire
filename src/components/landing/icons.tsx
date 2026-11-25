/** Small inline icons shared by the landing sections (stroke follows currentColor). */
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "aria-hidden": true } as const;

export const CheckIcon = ({ w = 2.5 }: { w?: number }) => (
  <svg {...base} strokeWidth={w}><path d="M20 6L9 17l-5-5" /></svg>
);
export const PlusIcon = () => <svg {...base} strokeWidth={2.5}><path d="M12 2v20M2 12h20" /></svg>;
export const CrossIcon = () => <svg {...base} strokeWidth={2.5}><path d="M18 6L6 18M6 6l12 12" /></svg>;
export const ArrowIcon = () => <svg {...base} strokeWidth={2}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const ShieldIcon = () => <svg {...base} strokeWidth={2}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>;
export const LockIcon = () => <svg {...base} strokeWidth={2}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" /></svg>;
export const ChatIcon = () => <svg {...base} strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>;
