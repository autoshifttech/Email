"use client";
import { useEffect } from "react";
import { pip } from "@/lib/fx";

/** Section title row (the reference "date row"): title on the left, glass pills on the right. */
export function PageHeader({ subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode; emoji?: string }) {
  // the page title lives in the app header; this row carries the subtitle and the page's glass pills
  if (!subtitle && !actions) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-5 rv">
      {subtitle ? <p className="small max-w-xl">{subtitle}</p> : <span />}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-500/12 text-emerald-800 border-emerald-600/25",
  red: "bg-rose-500/12 text-rose-700 border-rose-600/25",
  amber: "bg-amber-400/20 text-amber-800 border-amber-600/25",
  blue: "bg-sky-500/12 text-sky-800 border-sky-600/25",
  gray: "bg-white/60 text-[#55555f] border-white",
  purple: "bg-violet-500/12 text-violet-800 border-violet-600/25",
  orange: "bg-orange-400/20 text-[#a84400] border-orange-500/30",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ${BADGE[color]}`}>{children}</span>;
}

export function PriorityBadge({ p }: { p?: string | null }) {
  if (!p) return null;
  const c = p === "urgent" ? "red" : p === "high" ? "orange" : p === "low" ? "gray" : "blue";
  return <Badge color={c}>{p === "urgent" ? "🔥 " : p === "high" ? "⚡ " : ""}{p}</Badge>;
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, [keyof typeof BADGE, string]> = {
    connected: ["green", "● Connected"], error: ["red", "● Error"], pending: ["amber", "● Connecting…"], disabled: ["gray", "● Disabled"],
    PENDING_APPROVAL: ["orange", "⏳ Awaiting approval"], SENDING: ["blue", "Sending…"], SENT: ["green", "✓ Sent"], REJECTED: ["gray", "Cancelled"], FAILED: ["red", "✕ Failed"],
  };
  const [c, l] = map[s] ?? ["gray", s];
  return <Badge color={c}>{l}</Badge>;
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-[#1c1c3a]/25 backdrop-blur-[3px] p-0 md:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-noscroll
        className={`card modal-scroll xf-zoom w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} max-h-[92vh] overflow-y-auto !rounded-b-none md:!rounded-b-[30px] p-5 md:p-6 !bg-[#f3f3f6]/95`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="mini" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="block small mt-1.5">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm font-medium text-left" aria-pressed={checked}>
      <span className="tgl" data-on={checked}><i /></span>
      {label}
    </button>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  useEffect(() => { pip.react("wink", "worried", 1400); }, []);
  return (
    <div className="card p-10 text-center rv">
      <div className="shrug" aria-hidden>{icon === "🤷" ? "🤷" : icon}</div>
      <div className="text-lg font-bold">{title}</div>
      {text && <p className="muted text-sm mt-1.5 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />;
}

export function Loading() {
  return (
    <div className="card p-10 text-center muted">
      <Spinner /> <span className="ml-2">Loading…</span>
    </div>
  );
}

/** Small glass stat tile. */
export function Tile({ label, emoji, value, unit, href, children, className = "" }: { label: string; emoji?: string; value?: React.ReactNode; unit?: string; href?: string; children?: React.ReactNode; className?: string }) {
  const inner = (
    <>
      <div className="text-sm font-semibold">{label} {emoji}</div>
      {value !== undefined && <div className="tile-number mt-3">{value}</div>}
      {unit && <div className="text-xs muted mt-1">{unit}</div>}
      {children}
    </>
  );
  const cls = `card block p-4 rv ${className}`;
  return href ? <a href={href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
}

/** Glass bead with initials (orange when highlighted). */
export function Avatar({ name, size = 40, hot = false }: { name: string; size?: number; hot?: boolean }) {
  const initials = (name || "?").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <span
      className="rn"
      style={{ width: size, height: size, fontSize: size * 0.34, ...(hot ? { background: "var(--orange-grad)", color: "#fff" } : {}) }}
    >
      {initials}
    </span>
  );
}
