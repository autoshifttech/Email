"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useApi } from "@/lib/client";
import { anim, hopEl, reduced } from "@/lib/fx";
import { IconBack, IconChart, IconCheck, IconGrid, IconHome, IconInbox, IconPen } from "./icons";

type Stats = { unread: number; pending: number; demo?: boolean };

export const DOCK = [
  { href: "/", label: "Home", Icon: IconHome, badge: null },
  { href: "/inbox", label: "Inbox", Icon: IconInbox, badge: "unread" as const },
  { href: "/drafts", label: "Approve", Icon: IconCheck, badge: "pending" as const },
  { href: "/insights", label: "Insights", Icon: IconChart, badge: null },
  { href: "/more", label: "More", Icon: IconGrid, badge: null },
];
const MORE_CHILDREN = ["/accounts", "/contacts", "/ai", "/settings", "/compose"];
const TITLES: [string, string][] = [
  ["/inbox/", "Email"], ["/inbox", "Inbox"], ["/drafts", "Approvals"], ["/insights", "Insights"], ["/more", "More"],
  ["/accounts", "Email Accounts"], ["/contacts", "Contacts"], ["/ai", "AI Keys"], ["/settings", "Settings"], ["/compose", "Compose"],
];

/** Index of a path in the dock order (children of More count as More); used for slide direction. */
export function dockIndex(path: string) {
  if (MORE_CHILDREN.some((p) => path.startsWith(p))) return DOCK.length - 1 + (path.startsWith("/compose") ? 0.5 : 0.6);
  const i = DOCK.findIndex((d) => (d.href === "/" ? path === "/" : path.startsWith(d.href)));
  return i < 0 ? 0 : i + (path.split("/").length > 2 ? 0.5 : 0);
}

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Centered title between two round glass buttons; the orange one composes a new email. */
export function AppHeader() {
  const path = usePathname();
  const router = useRouter();
  const { data } = useApi<Stats>("/api/stats", { poll: 30_000 });
  const title = path === "/" ? "MailBridge" : TITLES.find(([p]) => path.startsWith(p))?.[1] ?? "MailBridge";
  const h1 = useRef<HTMLHeadingElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const lastPending = useRef<number | null>(null);

  useEffect(() => {
    const el = h1.current;
    if (!el) return;
    el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap");
  }, [title]);
  useEffect(() => {
    if (data && lastPending.current !== null && data.pending !== lastPending.current && badge.current) {
      badge.current.classList.remove("bump"); void badge.current.offsetWidth; badge.current.classList.add("bump");
    }
    if (data) lastPending.current = data.pending;
  }, [data]);

  const sub = path !== "/" && !DOCK.some((d) => d.href === path);
  return (
    <>
      {data?.demo && (
        <div role="status" className="mx-auto mb-3 w-fit rounded-full bg-white/80 text-[var(--orange-ink)] text-xs font-semibold px-3.5 py-1.5 shadow-sm">
          👀 Demo mode: sample data, changes aren&apos;t saved
        </div>
      )}
      <header className="head">
        {sub ? (
          <button type="button" className="circle" aria-label="Back" onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>
            <IconBack size={22} />
          </button>
        ) : (
          <Link href="/insights" className="circle" aria-label="Insights calendar" title="Insights">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
          </Link>
        )}
        <h1 ref={h1}>{title}</h1>
        <Link href="/compose" className="circle orange" aria-label={`Compose${data?.pending ? `, ${data.pending} drafts awaiting approval` : ""}`} title="Compose">
          <IconPen size={22} />
          {!!data?.pending && <span ref={badge} className="badge">{data.pending > 99 ? "99+" : data.pending}</span>}
          <span className="circle-cap">Compose</span>
        </Link>
      </header>
    </>
  );
}

/** Floating dock: one orange glass pill slides and stretches between tabs; icons hop on tap. */
export function Dock() {
  const path = usePathname();
  const { data } = useApi<Stats>("/api/stats", { poll: 30_000 });
  const dock = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const px = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const activeIdx = Math.min(DOCK.length - 1, Math.floor(dockIndex(path)));

  useIso(() => {
    const place = (animate: boolean) => {
      const b = dock.current?.querySelectorAll<HTMLElement>("a")[activeIdx];
      const p = pill.current;
      if (!b || !p) return;
      const x = b.offsetLeft, y = b.offsetTop, w = b.offsetWidth, h = b.offsetHeight;
      p.style.width = w + "px"; p.style.height = h + "px"; p.style.borderRadius = h / 2 + "px";
      const from = px.current;
      px.current = x;
      const to = `translate(${x}px,${y}px)`;
      p.style.transform = to;
      if (animate && !reduced() && from !== null && from !== x) {
        const d = x - from, k = 1 + Math.min(Math.abs(d) / 110, 1.1) * 0.45;
        anim(p, [
          { transform: `translate(${from}px,${y}px) scale(1,1)` },
          { transform: `translate(${from + d / 2}px,${y}px) scale(${k},.9)`, offset: 0.42 },
          { transform: to + " scale(1,1)" },
        ], { duration: 560, easing: "cubic-bezier(.34,1.25,.5,1)" });
      }
    };
    place(ready);
    setReady(true);
    const onR = () => place(false);
    window.addEventListener("resize", onR);
    document.fonts?.ready.then(() => place(false));
    return () => window.removeEventListener("resize", onR);
  }, [activeIdx]);

  return (
    <nav className="dock" ref={dock} aria-label="Main">
      <span ref={pill} className="dock-pill" aria-hidden />
      {DOCK.map(({ href, label, Icon, badge }, i) => {
        const n = badge && data ? data[badge] : 0;
        const on = i === activeIdx;
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            aria-label={label}
            onClick={(e) => { const a = e.currentTarget; hopEl(a.querySelector("svg")); hopEl(a.querySelector("span"), 60); }}
          >
            <Icon size={21} />
            <span>{label}</span>
            {n > 0 && <b className="nbadge">{n > 99 ? "99+" : n}</b>}
          </Link>
        );
      })}
    </nav>
  );
}

/** Kept for older imports. */
export function Nav() {
  return <Dock />;
}

export const MORE_ITEMS = [
  { href: "/accounts", label: "Email Accounts" },
  { href: "/contacts", label: "Contacts & Groups" },
  { href: "/ai", label: "AI Keys" },
  { href: "/settings", label: "Settings" },
];
