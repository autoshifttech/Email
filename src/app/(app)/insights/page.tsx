"use client";
import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/client";
import { BarChart } from "@/components/charts";
import { RollNumber, Ring, StatBar, WeekStrip, isoDay } from "@/components/motion";
import { Loading } from "@/components/ui";

type Insights = {
  date: string; received: number; unread: number; important: number; sent: number; aiSent: number; pending: number;
  hourly: number[]; byCategory: [string, number][];
};
const tz = () => new Date().getTimezoneOffset();
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00"); d.setDate(d.getDate() + n); return isoDay(d); };

export default function InsightsPage() {
  const today = isoDay(new Date());
  const [date, setDate] = useState(today);
  const weekStart = addDays(date, -new Date(date + "T00:00:00").getDay());
  const { data: days } = useApi<{ counts: number[] }>(`/api/days?from=${weekStart}&days=7&tz=${tz()}`);
  const { data } = useApi<Insights>(`/api/insights?date=${date}&tz=${tz()}`, { poll: 30_000 });
  const dt = new Date(date + "T00:00:00");
  const peak = data ? data.hourly.indexOf(Math.max(...data.hourly)) : -1;
  const read = data ? data.received - data.unread : 0;

  return (
    <>
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
      <div className="rv">
        <WeekStrip days={Array.from({ length: 7 }, (_, i) => ({ iso: addDays(weekStart, i), has: (days?.counts?.[i] ?? 0) > 0 }))} value={date} onChange={setDate} />
      </div>

      {!data ? <Loading /> : (
        <>
          <section className="card summary !mt-4 rv" aria-label="Day summary">
            <div className="sum-top">
              <div>
                <p className="muted">Received {date === today ? "today" : ""}</p>
                <div className="sum-big"><b><RollNumber value={data.received} /></b><span>email{data.received === 1 ? "" : "s"}</span></div>
                <p className="small mt-2">{data.unread ? `${data.unread} still unread` : data.received ? "All read 🎉" : "A quiet day"}</p>
              </div>
              <Ring pct={data.received ? (read / data.received) * 100 : 100} />
            </div>
            <div className="stats">
              <StatBar title="Replied" value={data.sent} total={Math.max(data.received, data.sent)} color="#ffb23d" buddy="rocket" />
              <StatBar title="Important" value={data.important} total={Math.max(data.received, 1)} color="#e03c3c" buddy="snail" />
              <StatBar title="Sent by AI" value={data.aiSent} total={Math.max(data.sent, data.aiSent, 1)} color="#f5b800" buddy="guard" />
            </div>
          </section>

          <div className="card p-5 mt-5 rv">
            <div className="sec">
              <h2>Emails by hour</h2>
              {data.received > 0 && <span className="pill !py-1.5 !px-3 text-xs">Busiest {String(peak).padStart(2, "0")}:00</span>}
            </div>
            <BarChart data={data.hourly.map((v, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: v }))} height={220} unit=" emails" highlight={peak >= 0 && data.received ? peak : undefined} />
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <div className="card p-5 rv">
              <h2 className="text-lg font-semibold mb-3">Top categories</h2>
              {!data.byCategory.length && <p className="small">No emails this day.</p>}
              <ul className="space-y-3">
                {data.byCategory.map(([c, n]) => (
                  <li key={c}>
                    <div className="flex justify-between text-sm mb-1"><span className="capitalize font-medium">{c}</span><span className="font-semibold tabular-nums">{n}</span></div>
                    <div className="bar"><i style={{ width: `${(n / Math.max(1, data.received)) * 100}%`, background: "linear-gradient(90deg,#ffb23d,#ee6a00)" }} /></div>
                  </li>
                ))}
              </ul>
            </div>
            <Link href="/drafts" className="card p-5 rv block">
              <h2 className="text-lg font-semibold">Approvals ⏳</h2>
              <div className="tile-number mt-3"><RollNumber value={data.pending} /></div>
              <p className="small mt-1">{data.pending ? "drafts are waiting for you →" : "Nothing waiting. You're all caught up!"}</p>
            </Link>
          </div>
        </>
      )}
    </>
  );
}
