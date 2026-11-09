"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/client";
import { BarChart } from "@/components/charts";
import { IconBack } from "@/components/icons";
import { Loading } from "@/components/ui";

type Insights = {
  date: string; received: number; unread: number; important: number; sent: number; aiSent: number; pending: number;
  hourly: number[]; byCategory: [string, number][];
};

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function InsightsPage() {
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 20 + i); return d; }), []);
  const [date, setDate] = useState(iso(new Date()));
  const tz = new Date().getTimezoneOffset();
  const { data } = useApi<Insights>(`/api/insights?date=${date}&tz=${tz}`, { poll: 30_000 });
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => { strip.current?.scrollTo({ left: strip.current.scrollWidth }); }, []);
  const sel = new Date(date + "T00:00:00");
  const isToday = date === iso(new Date());
  const peak = data ? data.hourly.indexOf(Math.max(...data.hourly)) : -1;

  return (
    <div className="max-w-3xl mx-auto">
      {/* header card: back + big emoji + gradient title */}
      <div className="glass p-5 pb-6 relative overflow-hidden rise">
        <div className="flex items-center">
          <Link href="/" className="btn btn-icon" aria-label="Back"><IconBack /></Link>
        </div>
        <span className="absolute left-[18%] top-[48%] text-xl opacity-90" aria-hidden>📨</span>
        <span className="absolute right-[14%] top-[30%] text-2xl opacity-90" aria-hidden>⚡</span>
        <div className="text-center -mt-4">
          <div className="text-6xl md:text-7xl drop-shadow-[0_10px_25px_rgba(255,90,60,.55)]" aria-hidden>📬</div>
          <h1 className="text-2xl md:text-3xl font-extrabold mt-2 grad-text">Insights</h1>
        </div>
      </div>

      {/* date strip */}
      <div ref={strip} className="flex gap-1.5 overflow-x-auto no-scrollbar py-4 -mx-1 px-1 rise" role="tablist" aria-label="Choose a day">
        {days.map((d) => {
          const v = iso(d);
          const on = v === date;
          const today = v === iso(new Date());
          return (
            <button
              key={v}
              role="tab"
              aria-selected={on}
              onClick={() => setDate(v)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${on ? "bg-white text-[#2b1fb0] shadow-lg" : "text-white/80 hover:bg-white/12"}`}
            >
              {on ? `${today ? "Today, " : ""}${d.getDate()} ${d.toLocaleDateString(undefined, { month: "short" })}` : d.getDate()}
            </button>
          );
        })}
      </div>

      {!data ? <Loading /> : (
        <div className="space-y-4">
          <div className="rise">
            <div className="text-sm font-semibold text-white/85">Emails received {isToday ? "today" : `on ${sel.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`}</div>
            <div className="flex items-end gap-2">
              <span className="hero-number">{data.received}</span>
              <span className="text-lg muted mb-2">{data.received === 1 ? "email" : "emails"}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3 rise">
            <Stat label="Sent" value={data.sent} />
            <Stat label="Sent by AI" value={data.aiSent} />
            <Stat label="Important" value={data.important} />
            <Stat label="Still unread" value={data.unread} />
          </div>

          <div className="glass p-5 rise">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold">Emails by hour</h2>
              {data.received > 0 && <span className="text-xs muted">Busiest: {String(peak).padStart(2, "0")}:00</span>}
            </div>
            <BarChart data={data.hourly.map((v, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: v }))} height={220} unit=" emails" highlight={peak >= 0 && data.received ? peak : undefined} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="glass p-5 rise">
              <h2 className="font-bold mb-3">Top categories</h2>
              {!data.byCategory.length && <p className="text-sm muted">No emails this day.</p>}
              <ul className="space-y-2.5">
                {data.byCategory.map(([c, n]) => (
                  <li key={c}>
                    <div className="flex justify-between text-sm mb-1"><span className="capitalize">{c}</span><span className="font-semibold tabular-nums">{n}</span></div>
                    <div className="h-1.5 rounded-full bg-white/15 overflow-hidden"><div className="h-full rounded-full bg-white/80" style={{ width: `${(n / data.received) * 100}%` }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/drafts" className="glass p-5 rise hover:bg-white/10 block">
              <h2 className="font-bold">Approvals ⏳</h2>
              <div className="tile-number mt-3">{data.pending}</div>
              <p className="text-sm muted mt-1">{data.pending ? "drafts are waiting for you" : "nothing waiting. You're all caught up!"}</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs font-semibold muted">{label}</div>
      <div className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</div>
    </div>
  );
}
