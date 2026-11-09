"use client";
import { useEffect } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="muted text-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const BADGE: Record<string, string> = {
  green: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  gray: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  purple: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export function Badge({ color = "gray", children }: { color?: keyof typeof BADGE; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE[color]}`}>{children}</span>;
}

export function PriorityBadge({ p }: { p?: string | null }) {
  if (!p) return null;
  const c = p === "urgent" ? "red" : p === "high" ? "amber" : p === "low" ? "gray" : "blue";
  return <Badge color={c}>{p}</Badge>;
}

export function StatusBadge({ s }: { s: string }) {
  const map: Record<string, [keyof typeof BADGE, string]> = {
    connected: ["green", "Connected"],
    error: ["red", "Error"],
    pending: ["amber", "Connecting…"],
    disabled: ["gray", "Disabled"],
    PENDING_APPROVAL: ["amber", "Awaiting approval"],
    SENDING: ["blue", "Sending…"],
    SENT: ["green", "Sent"],
    REJECTED: ["gray", "Cancelled"],
    FAILED: ["red", "Failed"],
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-0 md:p-6" onMouseDown={onClose}>
      <div
        className={`panel w-full ${wide ? "md:max-w-3xl" : "md:max-w-lg"} max-h-[92vh] overflow-y-auto rounded-b-none md:rounded-b-[0.875rem] p-5`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn btn-sm" onClick={onClose} aria-label="Close">✕</button>
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
      {hint && <span className="block text-xs muted mt-1">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm" aria-pressed={checked}>
      <span className={`relative inline-block h-5 w-9 rounded-full transition ${checked ? "bg-green-600" : "bg-gray-300 dark:bg-gray-600"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="panel p-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="font-semibold">{title}</div>
      {text && <p className="muted text-sm mt-1 max-w-md mx-auto">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]" />;
}

export function Loading() {
  return (
    <div className="panel p-10 text-center muted">
      <Spinner /> <span className="ml-2">Loading…</span>
    </div>
  );
}
