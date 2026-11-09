"use client";
import { useEffect } from "react";

export function PageHeader({ title, subtitle, actions, emoji }: { title: string; subtitle?: string; actions?: React.ReactNode; emoji?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6 rise">
      <div>
        <h1 className="text-[1.75rem] md:text-[2.1rem] font-bold tracking-tight leading-tight">
          {title} {emoji && <span className="align-middle">{emoji}</span>}
        </h1>
        {subtitle && <p className="muted text-sm mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-emerald-300/20 text-emerald-100 border-emerald-200/40",
  red: "bg-rose-400/25 text-rose-100 border-rose-200/40",
  amber: "bg-amber-300/25 text-amber-50 border-amber-200/40",
  blue: "bg-sky-300/20 text-sky-50 border-sky-200/40",
  gray: "bg-white/15 text-white/90 border-white/25",
  purple: "bg-fuchsia-300/20 text-fuchsia-50 border-fuchsia-200/40",
  orange: "bg-orange-300/25 text-orange-50 border-orange-200/40",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${BADGE[color]}`}>{children}</span>;
}

export function PriorityBadge({ p }: { p?: string | null }) {
  if (!p) return null;
  const c = p === "urgent" ? "red" : p === "high" ? "orange" : p === "low" ? "gray" : "blue";
  const icon = p === "urgent" ? "🔥" : p === "high" ? "⚡" : p === "low" ? "" : "";
  return <Badge color={c}>{icon} {p}</Badge>;
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, [keyof typeof BADGE, string]> = {
    connected: ["green", "● Connected"],
    error: ["red", "● Error"],
    pending: ["amber", "● Connecting…"],
    disabled: ["gray", "● Disabled"],
    PENDING_APPROVAL: ["amber", "⏳ Awaiting approval"],
    SENDING: ["blue", "Sending…"],
    SENT: ["green", "✓ Sent"],
    REJECTED: ["gray", "Cancelled"],
    FAILED: ["red", "✕ Failed"],
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-[#140a5a]/55 backdrop-blur-sm p-0 md:p-6" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`glass rise w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-b-none md:rounded-b-[26px] p-5 md:p-6 !bg-[#4a33dd]/80`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{title}</h2>
          <button className="btn btn-icon" onClick={onClose} aria-label="Close">✕</button>
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
      {hint && <span className="block text-xs muted mt-1.5">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5 text-sm text-left" aria-pressed={checked}>
      <span className={`relative inline-block h-6 w-11 shrink-0 rounded-full border transition ${checked ? "bg-white border-white" : "bg-white/15 border-white/35"}`}>
        <span className={`absolute top-[3px] h-4 w-4 rounded-full transition-all ${checked ? "left-[23px] bg-[#4b33ea]" : "left-[3px] bg-white/85"}`} />
      </span>
      {label}
    </button>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="glass p-10 text-center rise">
      <div className="text-5xl mb-3 drop-shadow-lg">{icon}</div>
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
    <div className="glass p-10 text-center muted">
      <Spinner /> <span className="ml-2">Loading…</span>
    </div>
  );
}

/** Small glass stat tile (the "Calories / Sleeping" tiles). */
export function Tile({ label, emoji, value, unit, href, children, className = "" }: { label: string; emoji?: string; value?: React.ReactNode; unit?: string; href?: string; children?: React.ReactNode; className?: string }) {
  const inner = (
    <>
      <div className="text-sm font-semibold text-white/90">{label} {emoji}</div>
      {value !== undefined && <div className="tile-number mt-3">{value}</div>}
      {unit && <div className="text-xs muted mt-1">{unit}</div>}
      {children}
    </>
  );
  const cls = `glass block p-4 rise hover:bg-white/10 transition ${className}`;
  return href ? <a href={href} className={cls}>{inner}</a> : <div className={cls}>{inner}</div>;
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = (name || "?").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white border-2 border-white/70 shadow-lg"
      style={{ width: size, height: size, fontSize: size * 0.36, background: "linear-gradient(135deg,#ffb36b,#ff4d8d 60%,#8b5cff)" }}
    >
      {initials}
    </span>
  );
}
