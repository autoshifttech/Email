"use client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { anim, face, jelly, ripple, rowMotion, stamp, vib } from "@/lib/fx";
import { timeAgo } from "@/lib/client";

export type RowEmail = {
  id: string; direction: string; fromName: string; fromAddress: string; to: string; subject: string; snippet: string;
  summary: string | null; priority: string | null; isRead: boolean; receivedAt: string; notifiedAt?: string | null; account?: { label: string };
};

export const initials = (s: string) =>
  (s || "?").split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";

const stateOf = (e: RowEmail) => (e.priority === "urgent" ? "A" : e.priority === "high" ? "O" : "P");

/**
 * Email row in the glass style. Tap opens it; swipe right = mark read (green),
 * swipe left = archive (red), long-press inflates the row like a balloon.
 * Urgent rows are tinted red, high-priority rows gold, unread rows get an orange dot.
 */
export function EmailRow({ e, onSwipe }: { e: RowEmail; onSwipe?: (e: RowEmail, action: "read" | "archive") => void }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLButtonElement>(null);
  const under = useRef<HTMLDivElement>(null);
  const g = useRef({ x0: 0, y0: 0, dx: 0, active: false, decided: false, moved: false, hold: 0, balloon: null as Animation | null, suppress: 0 });
  const who = e.direction === "OUT" ? e.to : e.fromName || e.fromAddress;
  const st = stateOf(e);
  const TH = 90;

  const setUnder = (dx: number) => {
    const u = under.current;
    if (!u) return;
    u.className = `sw-under ${dx > 0 ? "l" : "r"} ${Math.abs(dx) > TH ? "armed" : ""}`;
    u.style.opacity = String(Math.min(1, Math.abs(dx) / 40));
  };
  const springBack = (from: number) => {
    const r = row.current;
    if (!r) return;
    r.classList.remove("sw-drag");
    r.style.transform = "";
    anim(r, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${-from * 0.12}px)`, offset: 0.6 }, { transform: "translateX(0)" }], { duration: 420, easing: "cubic-bezier(.3,1.4,.5,1)" });
    if (under.current) under.current.style.opacity = "0";
  };

  const onPointerDown = (ev: React.PointerEvent) => {
    const s = g.current;
    s.x0 = ev.clientX; s.y0 = ev.clientY; s.dx = 0; s.active = true; s.decided = false; s.moved = false;
    clearTimeout(s.hold);
    s.hold = window.setTimeout(() => {
      if (s.moved) return;
      vib(12);
      s.balloon = anim(row.current, [{ scale: "1 1" }, { scale: "1.04 1.1", offset: 0.6 }, { scale: "1.03 1.07" }], { duration: 380, fill: "forwards", easing: "cubic-bezier(.34,1.6,.5,1)" });
    }, 450);
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const s = g.current;
    if (!s.active) return;
    const dx = ev.clientX - s.x0, dy = ev.clientY - s.y0;
    if (Math.hypot(dx, dy) > 8) { s.moved = true; clearTimeout(s.hold); }
    if (!s.decided) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3 && onSwipe && ev.pointerType !== "mouse") { s.decided = true; row.current?.classList.add("sw-drag"); try { (ev.target as Element).setPointerCapture?.(ev.pointerId); } catch { /* pointer already gone */ } }
      else if (Math.abs(dy) > 10) { s.active = false; return; }
      else return;
    }
    const resist = (v: number) => (Math.abs(v) > TH ? Math.sign(v) * (TH + (Math.abs(v) - TH) * 0.35) : v);
    s.dx = resist(dx);
    if (row.current) row.current.style.transform = `translateX(${s.dx}px)`;
    setUnder(s.dx);
  };
  const end = () => {
    const s = g.current;
    clearTimeout(s.hold);
    if (s.balloon) {
      s.balloon.cancel(); s.balloon = null; s.suppress = performance.now() + 400;
      anim(row.current, [{ scale: "1.03 1.07" }, { scale: ".95 .9", offset: 0.35 }, { scale: "1.02 1.03", offset: 0.6 }, { scale: "1 1" }], { duration: 520, easing: "ease-out" });
    }
    if (!s.active) return;
    s.active = false;
    if (!s.decided) return;
    s.suppress = performance.now() + 300;
    const dx = s.dx;
    if (Math.abs(dx) > TH && onSwipe) {
      const action = dx > 0 ? "read" : "archive";
      vib(action === "read" ? 15 : [20, 30, 20]);
      springBack(dx);
      rowMotion(row.current, action === "read" ? "P" : "A");
      const rn = row.current?.querySelector(".rn") || null;
      jelly(rn);
      face(rn, action === "read" ? "P" : "A");
      stamp(row.current, action === "read" ? "READ" : "ARCHIVED", action === "read" ? "#2f9a6c" : "#e03c3c");
      setTimeout(() => onSwipe(e, action), action === "archive" ? 700 : 250);
    } else springBack(dx);
  };

  return (
    <div className="sw-wrap" ref={wrap}>
      <div ref={under} className="sw-under l" style={{ opacity: 0 }} aria-hidden>
        <span className="sw-in"><span className="sw-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></span><b>Read</b></span>
        <span className="sw-in"><span className="sw-ico"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="5" rx="1.5" /><path d="M5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4" /></svg></span><b>Archive</b></span>
      </div>
      <button
        ref={row}
        type="button"
        className="row rv swipe"
        data-s={st}
        data-id={e.id}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        onClick={(ev) => {
          if (performance.now() < g.current.suppress) { ev.preventDefault(); return; }
          ripple(row.current?.querySelector(".rn") || null);
          jelly(row.current?.querySelector(".rn") || null);
          setTimeout(() => router.push(`/inbox/${e.id}`), 140);
        }}
      >
        <span className="rn">{initials(who)}</span>
        <span className="rt">
          <b>{e.direction === "OUT" ? `To: ${e.to}` : who}</b>
          <i>{e.subject}</i>
          <p>{e.summary ? `✨ ${e.summary}` : e.snippet}</p>
        </span>
        <span className="rx">
          {timeAgo(e.receivedAt)}
          {!e.isRead && e.direction === "IN" ? <span className="udot" aria-label="unread" /> : e.notifiedAt ? <span title="Sent to WhatsApp">💬</span> : null}
        </span>
      </button>
    </div>
  );
}

/** Every few seconds a random visible avatar bead blinks like a face. */
export function useBlinkingBeads(root: React.RefObject<HTMLElement | null>) {
  if (typeof window !== "undefined") {
    // set up once per mount via effect in caller
  }
  return () => {
    const iv = window.setInterval(() => {
      const el = root.current;
      if (!el || document.hidden) return;
      const vh = innerHeight;
      const beads = Array.from(el.querySelectorAll<HTMLElement>(".rn")).filter((r) => { const q = r.getBoundingClientRect(); return q.top > 60 && q.bottom < vh - 90; });
      if (!beads.length) return;
      const rn = beads[Math.floor(Math.random() * beads.length)];
      if (!rn.querySelector(".face")) face(rn, "blink");
    }, 3800);
    return () => clearInterval(iv);
  };
}
