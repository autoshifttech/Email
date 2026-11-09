"use client";
import { useId, useState } from "react";

export type Point = { label: string; value: number };

/** Smooth single-series line (the "Heart" tile style) with a hover crosshair + tooltip. */
export function Sparkline({ data, height = 70, unit = "" }: { data: Point[]; height?: number; unit?: string }) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const W = 200, H = height, pad = 6;
  const max = Math.max(1, ...data.map((d) => d.value));
  const pts = data.map((d, i) => [pad + (i * (W - pad * 2)) / Math.max(1, data.length - 1), H - pad - (d.value / max) * (H - pad * 2)] as const);
  const path = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const area = pts.length ? `${path} L${pts[pts.length - 1][0]},${H} L${pts[0][0]},${H} Z` : "";
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    pts.forEach(([px], i) => { if (Math.abs(px - x) < Math.abs(pts[best][0] - x)) best = i; });
    setHover(best);
  };
  const h = hover !== null ? pts[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" style={{ height }} preserveAspectRatio="none" onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label={`Trend: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`}>
        <defs>
          <linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff5a7a" stopOpacity=".35" />
            <stop offset="1" stopColor="#ff5a7a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#a${id})`} />
        <path d={path} fill="none" stroke="#ff5a7a" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        {h && <line x1={h[0]} x2={h[0]} y1={0} y2={H} stroke="rgba(255,255,255,.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray="3 3" />}
      </svg>
      {h && hover !== null && (
        <>
          <span className="pointer-events-none absolute h-2.5 w-2.5 -ml-[5px] -mt-[5px] rounded-full bg-white ring-2 ring-[#ff5a7a]" style={{ left: `${(h[0] / W) * 100}%`, top: (h[1] / H) * height }} />
          <div className="pointer-events-none absolute -top-9 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#2b1fb0] shadow-lg" style={{ left: `${Math.min(85, Math.max(15, (h[0] / W) * 100))}%` }}>
            {data[hover].label}: {data[hover].value}{unit}
          </div>
        </>
      )}
    </div>
  );
}

/** Thin vertical bars (the right-hand screen's chart) with gridlines + per-bar hover tooltip. */
export function BarChart({ data, height = 200, unit = "", highlight }: { data: Point[]; height?: number; unit?: string; highlight?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const ticks = [nice, (nice * 3) / 4, nice / 2, nice / 4, 0];
  return (
    <div className="flex gap-2" style={{ height }} role="img" aria-label={`Bar chart: ${data.filter((d) => d.value).map((d) => `${d.label} ${d.value}`).join(", ") || "no data"}`}>
      <div className="flex flex-col justify-between text-[10px] faint tabular-nums pb-5 text-right w-6 shrink-0">
        {ticks.map((t) => <span key={t}>{Number.isInteger(t) ? t : t.toFixed(1)}</span>)}
      </div>
      <div className="relative flex-1 min-w-0">
        <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between pointer-events-none">
          {ticks.map((t) => <div key={t} className="border-t border-white/12" />)}
        </div>
        <div className="absolute inset-x-0 top-0 bottom-5 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const on = hover === i || (hover === null && highlight === i);
            return (
              <div key={i} className="relative flex-1 h-full flex items-end justify-center cursor-default" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
                <div
                  className={`w-full max-w-[9px] rounded-t-[4px] transition-colors ${on ? "bg-white" : d.value ? "bg-white/55" : "bg-white/15"}`}
                  style={{ height: `${Math.max(d.value ? 4 : 2, (d.value / nice) * 100)}%` }}
                />
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full mb-1 z-10 whitespace-nowrap rounded-lg bg-white px-2 py-1 text-[11px] font-semibold text-[#2b1fb0] shadow-lg">
                    {d.label}: {d.value}{unit}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-4 flex text-[10px] faint">
          {data.map((d, i) => <span key={i} className="flex-1 text-center">{i % Math.ceil(data.length / 6) === 0 ? d.label : ""}</span>)}
        </div>
      </div>
    </div>
  );
}
