"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { anim, slot } from "@/lib/fx";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Odometer: each digit sits in a 0–9 column that slides to its new value (ones digit first). */
export function RollNumber({ value, suffix = "", className = "" }: { value: number; suffix?: string; className?: string }) {
  const str = String(Math.max(0, Math.round(value)));
  const [shown, setShown] = useState(str.replace(/\d/g, "0"));
  useEffect(() => {
    const t = requestAnimationFrame(() => setShown(str));
    return () => cancelAnimationFrame(t);
  }, [str]);
  const n = str.length;
  const from = shown.padStart(n, "0").slice(-n);
  return (
    <span className={className}>
      <span className="roll" aria-hidden>
        {Array.from({ length: n }, (_, i) => (
          <span key={`${n}-${i}`} className="rd">
            <span className="rc" style={{ transform: `translateY(-${from[i]}em)`, transitionDelay: `${(n - 1 - i) * 45}ms` }}>
              {"0123456789".split("").map((d) => <i key={d}>{d}</i>)}
            </span>
          </span>
        ))}
        {suffix && <span className="rs">{suffix}</span>}
      </span>
      <span className="sr">{str}{suffix}</span>
    </span>
  );
}

/** Progress ring that "boings" when it changes and flashes a green halo at 100%. */
export function Ring({ pct, label }: { pct: number; label?: React.ReactNode }) {
  const C = 276.46;
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<number | null>(null);
  const [off, setOff] = useState(C);
  const [halo, setHalo] = useState(0);
  useEffect(() => {
    const p = Math.max(0, Math.min(100, pct));
    const t = requestAnimationFrame(() => setOff(C - (C * p) / 100));
    if (prev.current !== null && prev.current !== p) {
      anim(ref.current, [{ transform: "scale(1)" }, { transform: "scale(1.12,.92)", offset: 0.25 }, { transform: "scale(.96,1.05)", offset: 0.55 }, { transform: "scale(1.02,.99)", offset: 0.8 }, { transform: "scale(1)" }], { duration: 560, easing: "ease-out" });
    }
    if (p >= 100 && prev.current !== null && prev.current < 100) setHalo((h) => h + 1);
    prev.current = p;
    return () => cancelAnimationFrame(t);
  }, [pct]);
  return (
    <div className="pring" ref={ref}>
      <svg viewBox="0 0 104 104" aria-hidden>
        <circle className="track" cx="52" cy="52" r="44" />
        <circle className="val" cx="52" cy="52" r="44" strokeDasharray={C} strokeDashoffset={off} />
      </svg>
      <b>{label ?? `${Math.round(pct)}%`}</b>
      {halo > 0 && <span key={halo} className="ring-halo" />}
    </div>
  );
}

const INK = "#7a2e00";
const S = { stroke: INK, strokeWidth: 1.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const BUDDIES = {
  rocket: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path className="fl" d="M6 12 L0 8.5 L3 12 L0 15.5 Z" fill="#ffb23d" />
      <path d="M7 9 L3 5.5 L8 11 Z" {...S} fill="#ee6a00" /><path d="M7 15 L3 18.5 L8 13 Z" {...S} fill="#ee6a00" />
      <path d="M5.5 12 Q13 4.5 22 12 Q13 19.5 5.5 12 Z" {...S} fill="#fff" />
      <path d="M17.5 8.2 Q21 9.5 22 12 Q21 14.5 17.5 15.8 Q19.5 12 17.5 8.2 Z" fill="#ee6a00" />
      <circle cx="12.5" cy="12" r="2.2" {...S} fill="#8fc7ff" />
    </svg>
  ),
  snail: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2 19 Q3 14.5 9 16.5 L20 16.5 Q22.5 17 22 19 Z" {...S} fill="#e8d6b8" />
      <circle cx="11" cy="11.5" r="6.2" {...S} fill="#ffb23d" />
      <path d="M11 11.5 m-2.6 0 a2.6 2.6 0 1 1 2.6 2.6 a1.3 1.3 0 0 1 -1.3 -1.3" fill="none" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
      <g className="sn-e"><path d="M19.5 16.5 L20 10" stroke={INK} strokeWidth="1.1" strokeLinecap="round" /><circle cx="20" cy="9.4" r="1.5" fill="#fff" stroke={INK} strokeWidth="1" /></g>
      <g className="sn-e" style={{ animationDelay: "-.6s" }}><path d="M16.5 16.5 L16.2 11" stroke={INK} strokeWidth="1.1" strokeLinecap="round" /><circle cx="16.2" cy="10.4" r="1.5" fill="#fff" stroke={INK} strokeWidth="1" /></g>
    </svg>
  ),
  guard: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <g className="gleg"><path d="M10.2 17.5 V22" stroke={INK} strokeWidth="2" strokeLinecap="round" /></g>
      <g className="gleg gleg2"><path d="M13.8 17.5 V22" stroke={INK} strokeWidth="2" strokeLinecap="round" /></g>
      <path d="M8.3 11.5 H15.7 V18 H8.3 Z" {...S} fill="#3b5bdb" /><circle cx="12" cy="14.6" r="1.4" fill="#ffd43d" />
      <circle cx="12" cy="7.8" r="4" {...S} fill="#ffd9b0" /><path d="M7.4 7.2 Q12 0.8 16.6 7.2 Z" {...S} fill="#3b5bdb" />
      <path d="M6.6 7.4 H17.4" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="10.4" cy="9" r=".7" fill="#1c1c20" /><circle cx="13.6" cy="9" r=".7" fill="#1c1c20" />
    </svg>
  ),
};

/** Stat tile with a sloshing bar, a buddy riding the end of the bar, and a slot-machine counter. */
export function StatBar({ title, value, total, color, buddy }: { title: string; value: number; total: number; color: string; buddy: keyof typeof BUDDIES }) {
  const pct = total ? Math.min(100, (value / total) * 100) : 0;
  const barRef = useRef<HTMLDivElement>(null);
  const budRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLElement>(null);
  const last = useRef<string | null>(null);
  const [w, setW] = useState(0);
  const text = `${value} / ${total}`;

  useEffect(() => {
    const t = requestAnimationFrame(() => setW(pct));
    return () => cancelAnimationFrame(t);
  }, [pct]);
  useEffect(() => {
    if (last.current !== null && last.current !== text) {
      slot(numRef.current);
      const bar = barRef.current;
      if (bar) { bar.classList.remove("slosh"); void bar.offsetWidth; bar.classList.add("slosh"); setTimeout(() => bar.classList.remove("slosh"), 1000); }
      anim(budRef.current, [{ transform: "scale(1)" }, { transform: "scale(1.3,.8)", offset: 0.25 }, { transform: "scale(.9,1.15)", offset: 0.55 }, { transform: "scale(1)" }], { duration: 520, easing: "ease-out" });
    }
    last.current = text;
  }, [text]);
  useIso(() => {
    const place = () => {
      const bar = barRef.current, b = budRef.current;
      if (!bar || !b) return;
      const size = 22;
      let x = bar.offsetLeft + (w / 100) * bar.offsetWidth - size * 0.55;
      x = Math.max(bar.offsetLeft - 2, Math.min(bar.offsetLeft + bar.offsetWidth - size + 3, x));
      b.style.left = x + "px";
      b.style.top = bar.offsetTop + bar.offsetHeight / 2 - size / 2 - 3 + "px";
      b.classList.toggle("full", w >= 99.5);
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [w]);

  return (
    <div className="stat">
      <p>{title}</p>
      <small ref={numRef}>{text}</small>
      <div className="bar" ref={barRef}><i style={{ background: color, width: `${w}%` }} /></div>
      <span ref={budRef} className={`bud ${buddy}`} aria-hidden>{BUDDIES[buddy]}</span>
    </div>
  );
}

export type WeekDay = { iso: string; has: boolean };

/** Seven-day strip: the selected day bounces over like a ball and its neighbours squish. */
export function WeekStrip({ days, value, onChange }: { days: WeekDay[]; value: string; onChange: (iso: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<string | null>(null);
  const today = isoDay(new Date());
  useEffect(() => {
    const root = ref.current;
    const sel = root?.querySelector<HTMLElement>(`.day[data-d="${value}"]`);
    const p = prev.current;
    prev.current = value;
    if (!root || !sel || !p || p === value) return;
    const all = Array.from(root.querySelectorAll<HTMLElement>(".day"));
    const idx = all.indexOf(sel);
    const pb = root.querySelector<HTMLElement>(`.day[data-d="${p}"]`);
    if (pb) {
      const dx = pb.getBoundingClientRect().left - sel.getBoundingClientRect().left;
      anim(sel, [
        { transform: `translate(${dx}px,-3px) scale(1,1)` }, { transform: `translate(${dx * 0.5}px,-30px) scale(.92,1.14)`, offset: 0.38 },
        { transform: "translate(0,-3px) scale(1.14,.84)", offset: 0.62 }, { transform: "translate(0,-12px) scale(.96,1.06)", offset: 0.78 },
        { transform: "translate(0,-3px) scale(1.03,.97)", offset: 0.92 }, { transform: "translate(0,-3px) scale(1,1)" },
      ], { duration: 640, easing: "ease-out" });
    }
    all.forEach((b, i) => {
      if (b === sel) return;
      anim(b, [{ transform: "scale(1,1)" }, { transform: "scale(1.05,.86)", offset: 0.35 }, { transform: "scale(.98,1.04)", offset: 0.7 }, { transform: "scale(1,1)" }], { duration: 520, delay: Math.abs(i - idx) * 45, easing: "ease-out" });
    });
  }, [value]);
  return (
    <div className="week" ref={ref} role="group" aria-label="Choose a day">
      {days.map((d) => {
        const dt = new Date(d.iso + "T00:00:00");
        const on = d.iso === value;
        return (
          <button
            key={d.iso}
            type="button"
            data-d={d.iso}
            aria-pressed={on}
            aria-label={dt.toDateString()}
            disabled={d.iso > today}
            className={`day ${d.has ? "has" : ""} ${d.iso > today ? "future" : ""}`}
            onClick={() => onChange(d.iso)}
          >
            <span>{dt.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
            <b>{dt.getDate()}</b>
            <em />
          </button>
        );
      })}
    </div>
  );
}

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Segmented slider with a draggable glowing knob (the reference "name style" control). */
export function Seg<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((x) => x + 1);
    window.addEventListener("resize", f);
    const t = setTimeout(f, 50);
    return () => { window.removeEventListener("resize", f); clearTimeout(t); };
  }, []);
  const pad = 6, k = 44;
  const geom = () => {
    const el = ref.current;
    if (!el) return { left: pad, fill: 130 };
    const opts = Array.from(el.querySelectorAll<HTMLElement>(".seg-opt"));
    const o = opts[idx];
    return { left: o ? o.offsetLeft + 4 : pad, fill: o ? o.offsetLeft + o.offsetWidth : 130 };
  };
  const g = geom();
  const left = drag ?? g.left;
  const onDown = (e: React.PointerEvent) => {
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const move = (ev: PointerEvent) => setDrag(Math.max(pad, Math.min(r.width - k - pad, ev.clientX - r.left - k / 2)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const x = ev.clientX - r.left;
      const opts = Array.from(el.querySelectorAll<HTMLElement>(".seg-opt"));
      let best = idx, bd = Infinity;
      opts.forEach((o, i) => { const c = o.offsetLeft + o.offsetWidth / 2, d = Math.abs(c - x); if (d < bd) { bd = d; best = i; } });
      setDrag(null);
      if (options[best] && options[best].value !== value) onChange(options[best].value);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div ref={ref} className={`seg ${drag !== null ? "drag" : ""}`} role="radiogroup" aria-label={label}>
      <div className="seg-clip" aria-hidden><div className="seg-fill" style={{ width: drag !== null ? drag + k : g.fill }} /></div>
      {options.map((o, i) => (
        <button key={o.value} type="button" role="radio" aria-checked={i === idx} className={`seg-opt ${i === idx ? "on" : ""}`} onClick={() => onChange(o.value)}>
          <span>{o.label}</span>
        </button>
      ))}
      <div className="seg-knob" style={{ left }} onPointerDown={onDown} aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </div>
    </div>
  );
}
