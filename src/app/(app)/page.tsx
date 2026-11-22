"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, useApi } from "@/lib/client";
import { anim, celebrate, pip, vib } from "@/lib/fx";
import { Pip, PipFace, type PipMood } from "@/components/pip";
import { RollNumber, Ring, StatBar, WeekStrip, isoDay } from "@/components/motion";
import { EmailRow, useBlinkingBeads, type RowEmail } from "@/components/email-row";
import { Loading } from "@/components/ui";
import { useToast, useUndo } from "@/components/toast";

type Stats = { ownerName: string; pending: number; sentToday: number; accounts: number; ai: unknown; whatsapp: boolean; demo?: boolean };
type List = { total: number; items: (RowEmail & { isArchived: boolean })[] };
type Filter = "all" | "unread" | "important" | "sent";

const tz = () => new Date().getTimezoneOffset();
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoDay(d); };

export default function Home() {
  const toast = useToast();
  const showUndo = useUndo();
  const today = isoDay(new Date());
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>("all");
  const { data: stats } = useApi<Stats>("/api/stats", { poll: 30_000 });
  const weekStart = addDays(date, -new Date(date + "T00:00:00").getDay());
  const { data: days } = useApi<{ counts: number[] }>(`/api/days?from=${weekStart}&days=7&tz=${tz()}`, { poll: 60_000 });
  const { data, setData, reload } = useApi<List>(`/api/emails?box=any&date=${date}&tz=${tz()}&pageSize=100`, { poll: 20_000 });

  const listRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLElement>(null);
  const [chipOn, setChipOn] = useState(false);
  const [armed, setArmed] = useState(false);
  useEffect(useBlinkingBeads(listRef), []);

  // the day's emails, split into the chip groups
  const all = useMemo(() => (data?.items ?? []).filter((e) => !(e.direction === "IN" && e.isArchived)), [data]);
  const inbox = all.filter((e) => e.direction === "IN");
  const groups: Record<Filter, typeof all> = {
    all: inbox,
    unread: inbox.filter((e) => !e.isRead),
    important: inbox.filter((e) => e.priority === "high" || e.priority === "urgent"),
    sent: all.filter((e) => e.direction === "OUT"),
  };
  const shown = groups[filter];
  const total = inbox.length, read = inbox.filter((e) => e.isRead).length;
  const pct = total ? (read / total) * 100 : 100;
  const mood: PipMood = !total ? "happy" : read / total >= 0.85 ? "happy" : read / total >= 0.65 ? "ok" : read / total >= 0.4 ? "worried" : "sad";

  // floating count chip once the summary card scrolls away
  useEffect(() => {
    const el = summaryRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([en]) => setChipOn(!en.isIntersecting && en.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [data]);

  // pull down at the top: Pip stretches and pulls a fresh list in
  useEffect(() => {
    let y0: number | null = null, x0 = 0, isArmed = false;
    const start = (e: TouchEvent) => { y0 = e.touches.length === 1 && window.scrollY <= 0 ? e.touches[0].clientY : null; x0 = e.touches[0].clientX; isArmed = false; };
    const move = (e: TouchEvent) => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0, dx = e.touches[0].clientX - x0;
      if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) return;
      pip.stretch(Math.min(dy, 110) / 110);
      const a = dy >= 80;
      if (a !== isArmed) { isArmed = a; pip.react(a ? "cheer" : "wink", a ? "grin" : "ok", 4000); }
    };
    const end = () => {
      if (y0 === null) return;
      pip.stretch(0);
      if (isArmed) {
        listRef.current?.querySelectorAll<HTMLElement>(".row").forEach((r, i) => { r.classList.remove("in"); r.style.setProperty("--d", i * 40 + "ms"); void r.offsetWidth; r.classList.add("in"); });
        pip.hop(true); pip.react("cheer", "grin", 900); vib(12);
        reload();
      }
      y0 = null; isArmed = false;
    };
    document.addEventListener("touchstart", start, { passive: true });
    document.addEventListener("touchmove", move, { passive: true });
    document.addEventListener("touchend", end, { passive: true });
    document.addEventListener("touchcancel", end, { passive: true });
    return () => {
      document.removeEventListener("touchstart", start); document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", end); document.removeEventListener("touchcancel", end);
    };
  }, [reload]);

  const patch = (id: string, body: Record<string, boolean>) => api(`/api/emails/${id}`, { method: "PATCH", body });
  const local = (id: string, p: Partial<RowEmail & { isArchived: boolean }>) =>
    setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...p } : x)) } : d));

  const onSwipe = async (e: RowEmail, action: "read" | "archive") => {
    const wasUnread = !e.isRead;
    try {
      if (action === "read") {
        local(e.id, { isRead: true });
        await patch(e.id, { isRead: true });
        pip.react("wink", "happy", 700);
        if (wasUnread && groups.unread.length === 1) { celebrate(summaryRef.current); pip.dance(); }
      } else {
        local(e.id, { isArchived: true });
        await patch(e.id, { isArchived: true });
        pip.react("gasp", "gasp", 650);
        showUndo("Archived “" + e.subject.slice(0, 28) + "”", async () => { local(e.id, { isArchived: false }); await patch(e.id, { isArchived: false }); pip.hop(); });
      }
    } catch (err) {
      toast("error", (err as Error).message);
      reload();
    }
  };

  const markAllRead = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
    setArmed(false);
    const ids = groups.unread.map((e) => e.id);
    if (!ids.length) return;
    try {
      ids.forEach((id) => local(id, { isRead: true }));
      await Promise.all(ids.map((id) => patch(id, { isRead: true })));
      // rows hop in a wave, then the big check + confetti
      const vh = innerHeight;
      let n = 0;
      listRef.current?.querySelectorAll(".row").forEach((r) => {
        const q = r.getBoundingClientRect();
        if (q.bottom < 0 || q.top > vh || n >= 24) return;
        anim(r, [{ transform: "translateY(0) scale(1,1)" }, { transform: "translateY(-14px) scale(.96,1.08)", offset: 0.4 }, { transform: "translateY(2px) scale(1.04,.95)", offset: 0.7 }, { transform: "none" }], { duration: 520, delay: n++ * 45, easing: "ease-out" });
      });
      setTimeout(() => celebrate(summaryRef.current), 300);
      toast("success", `Marked ${ids.length} email${ids.length === 1 ? "" : "s"} as read`);
    } catch (err) {
      toast("error", (err as Error).message);
      reload();
    }
  };

  const dt = new Date(date + "T00:00:00");
  const weekDays = Array.from({ length: 7 }, (_, i) => ({ iso: addDays(weekStart, i), has: (days?.counts?.[i] ?? 0) > 0 }));
  const chips: [Filter, string][] = [["all", "All"], ["unread", "Unread"], ["important", "Important"], ["sent", "Sent"]];
  const setupLeft = stats ? [!stats.accounts && ["Add an email account", "/accounts"], !stats.ai && ["Add a free AI key", "/ai"], !stats.whatsapp && ["Connect WhatsApp", "/settings"]].filter(Boolean) as [string, string][] : [];

  return (
    <>
      {stats && (
        <p className="text-[1.65rem] md:text-[2rem] font-semibold leading-tight mb-5 rv">
          {greeting()}, {stats.ownerName || "there"}!
        </p>
      )}

      <div className="daterow rv">
        <h2>{dt.getDate()} {dt.toLocaleDateString(undefined, { month: "long" })}, {dt.getFullYear()}</h2>
        <div className="flex items-center gap-2">
          {date !== today && <button type="button" className="pill text-[var(--orange-ink)] !py-2 !px-3.5 text-sm" onClick={() => setDate(today)}>Today</button>}
          <button type="button" className="mini" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
          </button>
          <button type="button" className="mini" aria-label="Next day" disabled={date >= today} onClick={() => date < today && setDate(addDays(date, 1))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      <div className="rv"><WeekStrip days={weekDays} value={date} onChange={setDate} /></div>

      <div className="chips rv" role="group" aria-label="Show emails">
        {chips.map(([k, label]) => (
          <button key={k} type="button" className="chip" aria-pressed={filter === k} onClick={() => { setFilter(k); vib(8); if (!groups[k].length) pip.react("wink", "worried", 1200); }}>
            {label} <small>{groups[k].length}</small>
            {filter === k && <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></svg>}
          </button>
        ))}
      </div>

      <section ref={summaryRef} className="card summary rv" aria-label="Summary">
        <Pip mood={mood} />
        <div className="sum-top">
          <div>
            <p className="muted">Read</p>
            <div className="sum-big"><b><RollNumber value={read} /></b><span>/ {total} email{total === 1 ? "" : "s"}</span></div>
            {!!stats?.pending && <Link href="/drafts" className="inline-flex mt-3 text-sm font-semibold text-[var(--orange-ink)]">⏳ {stats.pending} draft{stats.pending === 1 ? "" : "s"} awaiting approval →</Link>}
          </div>
          <Ring pct={pct} />
        </div>
        <div className="stats">
          <StatBar title="Read" value={read} total={total} color="#ffb23d" buddy="rocket" />
          <StatBar title="Important" value={groups.important.length} total={total} color="#e03c3c" buddy="snail" />
          <StatBar title="Replied" value={groups.sent.length} total={Math.max(total, groups.sent.length)} color="#f5b800" buddy="guard" />
        </div>
      </section>

      {setupLeft.length > 0 && (
        <div className="card p-4 mt-5 rv">
          <p className="font-semibold mb-2">🚀 Finish setting up</p>
          <div className="flex flex-wrap gap-2">{setupLeft.map(([l, h]) => <Link key={h} href={h} className="pill text-sm">{l} →</Link>)}</div>
        </div>
      )}

      <div className="sec mt-7 rv">
        <h2>Emails <small>{shown.length}</small></h2>
        <button type="button" className={`pill ${armed ? "text-[var(--orange-ink)]" : ""}`} onClick={markAllRead} disabled={!groups.unread.length}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 7 17l-5-5" /><path d="m22 10-7.5 7.5L13 16" /></svg>
          {armed ? "Tap again to confirm" : "Mark all read"}
        </button>
      </div>
      <p className="small mb-3 rv">Tap to open · swipe right = Read · swipe left = Archive</p>

      {!data ? <Loading /> : !shown.length ? (
        <div className="card p-8 text-center rv">
          <div className="shrug" aria-hidden>🤷</div>
          <p className="font-semibold">{filter === "unread" && total ? "All caught up!" : "No emails here"}</p>
          <p className="small mt-1">{date === today ? "New emails appear here the moment they arrive." : "Nothing for this day."}</p>
        </div>
      ) : (
        <div className="list two" ref={listRef}>
          {shown.map((e) => <EmailRow key={e.id} e={e} onSwipe={e.direction === "IN" ? onSwipe : undefined} />)}
        </div>
      )}

      <button type="button" className={`xchip ${chipOn ? "show" : ""}`} onClick={() => summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })} aria-label="Back to summary">
        <PipFace className="w-[30px] h-[18px]" />
        Read <b>{read}/{total}</b>{groups.unread.length > 0 && <small>{groups.unread.length} unread</small>}
        <i style={{ width: `${pct}%` }} />
      </button>
    </>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good day" : "Good evening";
}
