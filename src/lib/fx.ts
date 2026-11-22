"use client";
/**
 * Motion effects (client only). Ported from the reference design: paper plane, smoke puffs, star confetti, drawn
 * checkmarks, rubber stamps, faces on avatar beads, squash-and-stretch springs,
 * slot-machine counters, and an event bus that lets the mascot Pip react.
 * Everything is transform/opacity based and switches off for reduced motion.
 */

export const reduced = () =>
  typeof window === "undefined" || !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const FULL = () => typeof window !== "undefined" && typeof Element.prototype.animate === "function" && !reduced();

export function anim(el: Element | null | undefined, kf: Keyframe[], opt: KeyframeAnimationOptions | number) {
  if (!el || !FULL()) return null;
  try {
    return el.animate(kf, opt);
  } catch {
    return null;
  }
}
const rm = (el: Element | null | undefined) => el?.parentNode?.removeChild(el);
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export function vib(p: number | number[]) {
  try {
    navigator.vibrate?.(p);
  } catch {
    /* no haptics */
  }
}

// ───────────────────────── Pip event bus ─────────────────────────
export type PipReact = "cheer" | "wink" | "gasp" | "salute" | "squint" | "talk";
export type PipMouth = "happy" | "ok" | "worried" | "sad" | "grin" | "gasp";
type PipCmd = { kind: "react"; name: PipReact; mouth: PipMouth; ms?: number } | { kind: "hop"; big?: boolean } | { kind: "cheer" } | { kind: "dance" } | { kind: "stretch"; amount: number };
export const pip = {
  send(cmd: PipCmd) {
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("mb:pip", { detail: cmd }));
  },
  react(name: PipReact, mouth: PipMouth, ms?: number) { pip.send({ kind: "react", name, mouth, ms }); },
  hop(big = false) { pip.send({ kind: "hop", big }); },
  cheer() { pip.send({ kind: "cheer" }); },
  dance() { pip.send({ kind: "dance" }); },
  stretch(amount: number) { pip.send({ kind: "stretch", amount }); },
};

// ───────────────────────── springs ─────────────────────────
export function jelly(el: Element | null) {
  anim(el, [
    { transform: "scale(1)" }, { transform: "scale(1.3,.72)", offset: 0.2 }, { transform: "scale(.82,1.25)", offset: 0.45 },
    { transform: "scale(1.12,.92)", offset: 0.68 }, { transform: "scale(.97,1.04)", offset: 0.85 }, { transform: "scale(1)" },
  ], { duration: 640, easing: "ease-out" });
}
export function hopEl(el: Element | null, delay = 0) {
  anim(el, [
    { transform: "translateY(0) scale(1,1)" }, { transform: "translateY(2px) scale(1.2,.78)", offset: 0.2 },
    { transform: "translateY(-13px) scale(.86,1.2)", offset: 0.48 }, { transform: "translateY(0) scale(1.18,.84)", offset: 0.72 },
    { transform: "translateY(-3px) scale(.97,1.04)", offset: 0.86 }, { transform: "translateY(0) scale(1,1)" },
  ], { duration: 640, delay, easing: "ease-out" });
}
export function squash(el: Element | null) {
  anim(el, [{ transform: "scale(1)" }, { transform: "scale(1.2,.85)", offset: 0.3 }, { transform: "scale(.92,1.1)", offset: 0.6 }, { transform: "scale(1)" }], { duration: 480, easing: "ease-out" });
}
export function shake(el: Element | null) {
  anim(el, [
    { transform: "translateX(0)" }, { transform: "translateX(-8px) rotate(-1.5deg)", offset: 0.25 }, { transform: "translateX(6px) rotate(1.2deg)", offset: 0.5 },
    { transform: "translateX(-4px)", offset: 0.72 }, { transform: "translateX(2px)", offset: 0.88 }, { transform: "translateX(0)" },
  ], { duration: 460, easing: "ease-out" });
}
/** A row reacts to a state change: P = happy hop, A = shake, O = wobble. */
export function rowMotion(row: Element | null, st: "P" | "A" | "O") {
  const kf: Keyframe[] =
    st === "A" ? [
      { transform: "translateX(0) scale(1,1)" }, { transform: "translateX(0) scale(1.04,.93)", offset: 0.12 }, { transform: "translateX(-8px) rotate(-1.5deg)", offset: 0.3 },
      { transform: "translateX(6px) rotate(1.2deg)", offset: 0.5 }, { transform: "translateX(-4px)", offset: 0.7 }, { transform: "translateX(2px)", offset: 0.86 }, { transform: "translateX(0) scale(1,1)" },
    ] : st === "O" ? [
      { transform: "rotate(0deg) scale(1)" }, { transform: "rotate(-3deg) scale(1.03)", offset: 0.25 }, { transform: "rotate(2deg)", offset: 0.5 }, { transform: "rotate(-1deg)", offset: 0.75 }, { transform: "rotate(0deg) scale(1)" },
    ] : [
      { transform: "scale(1,1)" }, { transform: "scale(1.06,.9)", offset: 0.18 }, { transform: "translateY(-9px) scale(.95,1.1)", offset: 0.45 },
      { transform: "translateY(0) scale(1.05,.94)", offset: 0.68 }, { transform: "scale(.99,1.01)", offset: 0.85 }, { transform: "scale(1,1)" },
    ];
  anim(row, kf, { duration: st === "A" ? 460 : 520, easing: "ease-out" });
}
export function ripple(el: Element | null) {
  if (!el || !FULL()) return;
  const r = document.createElement("span");
  r.className = "ripple";
  el.appendChild(r);
  setTimeout(() => rm(r), 650);
}

// ───────────────────────── faces on avatar beads ─────────────────────────
const FACE = {
  P: '<svg class="face" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 18.5 Q14 13.5 17.5 18.5"/><path d="M22.5 18.5 Q26 13.5 29.5 18.5"/><path d="M11.5 25 Q20 35 28.5 25"/></g></svg>',
  A: '<svg class="face" viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor"><circle cx="14" cy="19" r="2.4"/><circle cx="26" cy="19" r="2.4"/><path d="M29.5 22 q2.6 3.6 0 5.4 q-2.6 -1.8 0 -5.4z" opacity=".75"/></g><g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9.5 12.5 L17 15"/><path d="M30.5 12.5 L23 15"/><path d="M13 30.5 Q20 23.5 27 30.5"/></g></svg>',
  O: '<svg class="face" viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor"><circle cx="14" cy="22" r="2.3"/><circle cx="26" cy="22" r="2.3"/><path d="M7 15.5 Q8 4.5 20 4.5 Q32 4.5 33 15.5 Z"/><rect x="5.5" y="14.5" width="29" height="3.2" rx="1.6"/><rect x="28" y="7.5" width="10" height="4" rx="2" transform="rotate(-28 33 9.5)"/></g><path d="M14 29.5 Q20 33 26 29.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
  blink: '<svg class="face" viewBox="0 0 40 40" aria-hidden="true"><g fill="currentColor"><circle class="e" cx="14" cy="19" r="2.6"/><circle class="e" cx="26" cy="19" r="2.6"/></g><path d="M13 27 Q20 33 27 27" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>',
};
const FACE_KF: Record<"P" | "A" | "O", Keyframe[]> = {
  P: [{ transform: "scale(.2) translateY(6px)" }, { transform: "scale(1.2,.85) translateY(0)", offset: 0.25 }, { transform: "scale(.92,1.15) translateY(-6px)", offset: 0.5 }, { transform: "scale(1.05,.95) translateY(0)", offset: 0.75 }, { transform: "scale(1)" }],
  A: [{ transform: "scale(.2) rotate(0deg)" }, { transform: "scale(1.15) rotate(-14deg)", offset: 0.25 }, { transform: "scale(1) rotate(12deg)", offset: 0.45 }, { transform: "rotate(-8deg)", offset: 0.62 }, { transform: "rotate(5deg)", offset: 0.78 }, { transform: "rotate(0deg)" }],
  O: [{ transform: "scale(.2) rotate(-30deg)" }, { transform: "scale(1.15) rotate(10deg)", offset: 0.3 }, { transform: "rotate(-6deg)", offset: 0.55 }, { transform: "rotate(3deg)", offset: 0.78 }, { transform: "rotate(0deg)" }],
};
export function face(rn: Element | null, kind: "P" | "A" | "O" | "blink") {
  if (!rn || !FULL()) return;
  rm(rn.querySelector(".face"));
  rn.insertAdjacentHTML("beforeend", FACE[kind]);
  rn.classList.add("has-face");
  const f = rn.querySelector(".face");
  if (kind === "blink") {
    anim(f, [{ opacity: 0, transform: "scale(.6)" }, { opacity: 1, transform: "scale(1)" }], { duration: 180, fill: "forwards" });
    f?.querySelectorAll(".e").forEach((c) => anim(c, [{ transform: "scaleY(1)" }, { transform: "scaleY(.1)", offset: 0.3 }, { transform: "scaleY(1)", offset: 0.45 }, { transform: "scaleY(.1)", offset: 0.7 }, { transform: "scaleY(1)" }], { duration: 900 }));
    setTimeout(() => { rm(f); rn.classList.remove("has-face"); }, 950);
    return;
  }
  anim(f, FACE_KF[kind], { duration: 820, easing: "ease-out" });
  setTimeout(() => {
    anim(f, [{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
    setTimeout(() => { rm(f); rn.classList.remove("has-face"); }, 200);
  }, 1050);
}

// ───────────────────────── rubber stamp ─────────────────────────
export function stamp(row: Element | null, text: string, color = "#e03c3c") {
  if (!row || !FULL()) return;
  const s = document.createElement("span");
  s.className = "stamp";
  s.textContent = text;
  (s.style as CSSStyleDeclaration).setProperty("--stc", color);
  row.appendChild(s);
  const R = "rotate(-14deg) ";
  const a = anim(s, [
    { transform: R + "scale(2.6)", opacity: 0 }, { transform: R + "scale(.92)", opacity: 1, offset: 0.3 }, { transform: R + "scale(1.05)", offset: 0.42 },
    { transform: R + "scale(1)", opacity: 1, offset: 0.55 }, { transform: R + "scale(1)", opacity: 1, offset: 0.82 }, { transform: R + "scale(1)", opacity: 0 },
  ], { duration: 1300, fill: "forwards" });
  if (a) a.onfinish = () => rm(s);
  setTimeout(() => rm(s), 1700);
  anim(row, [{ transform: "translateY(0)" }, { transform: "translateY(4px)", offset: 0.4 }, { transform: "translateY(0)" }], { duration: 240, delay: 380, easing: "ease-out" });
}

// ───────────────────────── smoke puff ─────────────────────────
export function cloud(x: number, y: number, sz = 18, n = 8) {
  if (!FULL()) return;
  const cols = ["#ffffff", "#f4f5fb", "#e6e8f4"];
  for (let i = 0; i < n; i++) {
    const s = sz * rnd(0.6, 1.1), c = document.createElement("i");
    c.className = "puff";
    c.style.cssText = `left:${x - s / 2}px;top:${y - s / 2}px;width:${s}px;height:${s}px;background:${cols[i % 3]}`;
    document.body.appendChild(c);
    const ang = rnd(0, Math.PI * 2), dist = rnd(0.3, 1) * sz * 1.3;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.8 - sz * 0.25;
    const a = anim(c, [
      { transform: "translate(0,0) scale(.2)", opacity: 0.98 },
      { transform: `translate(${dx * 0.7}px,${dy * 0.7}px) scale(1.15)`, opacity: 0.95, offset: 0.45 },
      { transform: `translate(${dx}px,${dy - 10}px) scale(1.5)`, opacity: 0 },
    ], { duration: rnd(650, 950), easing: "ease-out", fill: "forwards" });
    if (a) a.onfinish = () => rm(c);
    setTimeout(() => rm(c), 1300);
  }
}

// ───────────────────────── star confetti ─────────────────────────
export function confetti(x?: number, y?: number, n = 34) {
  if (!FULL()) return;
  const cx = x ?? window.innerWidth / 2, cy = y ?? window.innerHeight * 0.4;
  const cols = ["#ffb23d", "#ee6a00", "#f5b800", "#e03c3c", "#4fb286", "#5b7cff", "#ff8ab5"];
  for (let i = 0; i < n; i++) {
    const s = rnd(9, 16), c = document.createElement("i");
    c.className = "xconf";
    c.style.cssText = `left:${cx - s / 2}px;top:${cy - s / 2}px;width:${s}px;background:${cols[i % cols.length]}`;
    document.body.appendChild(c);
    const ang = rnd(-Math.PI, 0), v = rnd(120, 300);
    const dx = Math.cos(ang) * v, dy = Math.sin(ang) * v;
    const a = anim(c, [
      { transform: "translate(0,0) rotate(0deg) scale(.4)", opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) rotate(${rnd(180, 540)}deg) scale(1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${dx * 1.25}px,${dy + rnd(260, 420)}px) rotate(${rnd(540, 900)}deg) scale(.9)`, opacity: 0 },
    ], { duration: rnd(1300, 1900), easing: "cubic-bezier(.2,.7,.4,1)", fill: "forwards" });
    if (a) a.onfinish = () => rm(c);
    setTimeout(() => rm(c), 2200);
  }
}

// ───────────────────────── drawn checkmarks ─────────────────────────
let ckSmall: HTMLDivElement | null = null, ckBig: HTMLDivElement | null = null;
function mkCheck(cls: string) {
  const d = document.createElement("div");
  d.className = cls;
  d.setAttribute("aria-hidden", "true");
  d.innerHTML = '<svg viewBox="0 0 52 52"><circle class="ck-bg" cx="26" cy="26" r="23"/><circle class="ck-c" cx="26" cy="26" r="23" transform="rotate(-90 26 26)" pathLength="1"/><path class="ck-p" d="M15 27.5l7.5 7.5L37.5 19" pathLength="1"/></svg>';
  document.body.appendChild(d);
  return d;
}
function play(d: HTMLDivElement, ms: number) {
  d.classList.remove("on");
  void d.offsetWidth;
  d.classList.add("on");
  clearTimeout((d as unknown as { _t: number })._t);
  (d as unknown as { _t: number })._t = window.setTimeout(() => d.classList.remove("on"), ms);
}
/** Small orange check next to an element (e.g. "saved"), or a big green one in the middle ("all done"). */
export function check(kind: "sm" | "big" = "big", near?: Element | null) {
  if (typeof document === "undefined") return;
  if (kind === "big") {
    ckBig ??= mkCheck("ck ck-big");
    play(ckBig, 1500);
    vib([15, 40, 15]);
    return;
  }
  ckSmall ??= mkCheck("ck ck-sm");
  const r = near?.getBoundingClientRect();
  ckSmall.style.left = (r ? r.right + 8 : window.innerWidth - 44) + "px";
  ckSmall.style.top = (r ? r.top + r.height / 2 - 14 : 14) + "px";
  play(ckSmall, 1500);
}

// ───────────────────────── paper plane ─────────────────────────
/** Plain paper plane (white body, indigo outline). */
export const PLANE_SVG =
  `<path d="m22 2-7 20-4-9-9-4z" style="fill:#fff;stroke:#2b1fb0;stroke-width:1.6;stroke-linejoin:round"/>` +
  `<path d="M22 2 11 13" style="fill:none;stroke:#2b1fb0;stroke-width:1.6;stroke-linecap:round"/>`;

/** A paper plane launches from `btn` with a puff, does a loop-the-loop and flies off top-right with speed lines. */
export function plane(btn: Element | null) {
  if (!btn || !FULL()) return;
  const ic = btn.querySelector("svg") || btn, r = ic.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const p0 = { x: cx - 9, y: cy + 8 }, p2 = { x: window.innerWidth + 80, y: -100 };
  const dX = p2.x - p0.x, dY = p0.y - p2.y;
  const p1 = { x: p0.x + dX * 0.22, y: p0.y - dY * 0.8 };
  const B = (u: number) => { const a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c = u * u; return { x: a * p0.x + b * p1.x + c * p2.x, y: a * p0.y + b * p1.y + c * p2.y }; };
  const DUR = 1350, WIND = 0.12, N = 72, ease = (t: number) => Math.pow(t, 1.8);

  // the route: the swoop, with a loop-the-loop dropped in at 30% of the curve
  const LU = 0.3, R = 24, K1 = 22, K2 = 30, K3 = 36, pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= K1; i++) pts.push(B((LU * i) / K1));
  const e = 0.002, a0 = B(LU - e), a1 = B(LU + e), tl = Math.hypot(a1.x - a0.x, a1.y - a0.y) || 1;
  const tx = (a1.x - a0.x) / tl, ty = (a1.y - a0.y) / tl, nx = -ty, ny = tx, bp = B(LU);
  for (let i = 1; i <= K2; i++) {
    const ph = (i / K2) * Math.PI * 2, sn = Math.sin(ph), cs = 1 - Math.cos(ph);
    pts.push({ x: bp.x + R * (sn * tx + cs * nx), y: bp.y + R * (sn * ty + cs * ny) });
  }
  for (let i = 1; i <= K3; i++) pts.push(B(LU + ((1 - LU) * i) / K3));
  const cum = [0], hd: number[] = [];
  let prevH = 0;
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const total = cum[cum.length - 1];
  for (let i = 0; i < pts.length; i++) {
    const j = Math.min(i, pts.length - 2);
    let h = Math.atan2(pts[j + 1].y - pts[j].y, pts[j + 1].x - pts[j].x);
    if (i) { while (h - prevH > Math.PI) h -= 2 * Math.PI; while (h - prevH < -Math.PI) h += 2 * Math.PI; }
    hd.push(h);
    prevH = h;
  }
  const at = (s: number) => {
    const tgt = Math.max(0, Math.min(1, s)) * total;
    let k = 1;
    while (k < cum.length - 1 && cum[k] < tgt) k++;
    const span = cum[k] - cum[k - 1] || 1, f = (tgt - cum[k - 1]) / span;
    return { x: pts[k - 1].x + (pts[k].x - pts[k - 1].x) * f, y: pts[k - 1].y + (pts[k].y - pts[k - 1].y) * f, h: hd[k - 1] + (hd[k] - hd[k - 1]) * f };
  };

  // launch: the button squashes and a puff of smoke pops out
  cloud(cx, cy, 18, 6);
  anim(btn, [{ transform: "scale(1,1)" }, { transform: "scale(1.18,.8)", offset: 0.25 }, { transform: "scale(.9,1.12)", offset: 0.55 }, { transform: "scale(1,1)" }], { duration: 480, easing: "ease-out" });
  vib([10, 30, 10]);

  const NS = "http://www.w3.org/2000/svg";
  const pl = document.createElementNS(NS, "svg");
  pl.setAttribute("viewBox", "0 0 24 24");
  pl.setAttribute("class", "plane-fly");
  pl.setAttribute("aria-hidden", "true");
  pl.innerHTML = PLANE_SVG;
  (pl as unknown as HTMLElement).style.left = cx - 15 + "px";
  (pl as unknown as HTMLElement).style.top = cy - 15 + "px";
  document.body.appendChild(pl);
  const q0 = at(0);
  const kf: Keyframe[] = [
    { transform: "translate(0px,0px) rotate(0deg) scale(1)", opacity: 1, offset: 0 },
    { transform: `translate(${p0.x - cx}px,${p0.y - cy}px) rotate(${(q0.h * 180) / Math.PI + 45}deg) scale(1.04)`, opacity: 1, offset: WIND },
  ];
  for (let k = 1; k <= N; k++) {
    const tt = k / N, s = ease(tt), q = at(s);
    kf.push({ transform: `translate(${q.x - cx}px,${q.y - cy}px) rotate(${(q.h * 180) / Math.PI + 45}deg) scale(${1.04 - 0.5 * s})`, opacity: tt < 0.82 ? 1 : Math.max(0, 1 - (tt - 0.82) / 0.18), offset: WIND + (1 - WIND) * tt });
  }
  const fl = pl.animate(kf, { duration: DUR, easing: "linear", fill: "forwards" });

  // trail: a short dash chasing the plane along the same route
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "plane-trail");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(NS, "path"), tail = 0.3;
  path.setAttribute("d", "M" + pts.map((p) => p.x.toFixed(1) + " " + p.y.toFixed(1)).join("L"));
  path.setAttribute("pathLength", "1");
  path.style.strokeDasharray = tail + " 3";
  path.style.strokeDashoffset = String(tail);
  svg.appendChild(path);
  document.body.appendChild(svg);

  const streak = (x: number, y: number, deg: number) => {
    const d = document.createElement("i");
    d.className = "streak";
    d.style.cssText = `left:${x}px;top:${y}px;width:${16 + Math.random() * 14}px;transform:rotate(${deg}deg)`;
    document.body.appendChild(d);
    const a = d.animate([{ transform: `rotate(${deg}deg) scaleX(1)`, opacity: 0.95 }, { transform: `rotate(${deg}deg) translateX(14px) scaleX(.15)`, opacity: 0 }], { duration: 380, easing: "ease-out", fill: "forwards" });
    a.onfinish = () => rm(d);
    setTimeout(() => rm(d), 700);
  };
  const t0 = performance.now(), TD = DUR * 1.15;
  let lastLine = 0;
  const step = (now: number) => {
    const t = (now - t0) / DUR;
    const head = t < WIND ? 0 : t <= 1 ? ease((t - WIND) / (1 - WIND)) : 1 + Math.min(1, (t - 1) / 0.15) * tail;
    path.style.strokeDashoffset = (tail - head).toFixed(4);
    svg.style.opacity = String(t > 1 ? Math.max(0, 1 - (t - 1) / 0.15) : 1);
    if (t > WIND && t < 0.94 && now - lastLine > 48) {
      lastLine = now;
      const qq = at(head), c = Math.cos(qq.h), sn2 = Math.sin(qq.h), deg = (qq.h * 180) / Math.PI + 180;
      for (let m = -1; m <= 1; m += 2) streak(qq.x - c * 14 - sn2 * 7 * m, qq.y - sn2 * 14 + c * 7 * m, deg);
    }
    if (now - t0 < TD) requestAnimationFrame(step);
    else svg.remove();
  };
  requestAnimationFrame(step);
  fl.onfinish = () => pl.remove();
  setTimeout(() => { pl.remove(); svg.remove(); }, DUR * 1.6);

  // the button's own icon flies away and springs back
  if (ic !== btn) anim(ic, [{ opacity: 1, transform: "scale(1)", offset: 0 }, { opacity: 0, transform: "scale(.6)", offset: 0.05 }, { opacity: 0, transform: "scale(.6)", offset: 0.7 }, { opacity: 1, transform: "scale(1.18)", offset: 0.86 }, { opacity: 1, transform: "scale(1)", offset: 1 }], { duration: 1450, easing: "ease-out" });
}

// ───────────────────────── slot-machine counter ─────────────────────────
export function slot(el: HTMLElement | null) {
  if (!el || !FULL() || (el as unknown as { _sp?: number })._sp) return;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el), m = /^(\d+)(.*)$/.exec((el.textContent || "").trim());
  if (!m || !r.width) return;
  (el as unknown as { _sp?: number })._sp = 1;
  const ov = document.createElement("div");
  ov.className = "slot";
  ov.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-family:${cs.fontFamily};color:${cs.color};letter-spacing:${cs.letterSpacing};justify-content:flex-start`;
  document.body.appendChild(ov);
  el.style.visibility = "hidden";
  const digits = m[1].length;
  let n = 0;
  const iv = setInterval(() => {
    ov.textContent = String(Math.floor(Math.random() * Math.pow(10, digits))).padStart(digits, "0") + m[2];
    if (++n > 7) {
      clearInterval(iv);
      rm(ov);
      el.style.visibility = "";
      (el as unknown as { _sp?: number })._sp = 0;
      anim(el, [{ transform: "scale(1.4,.7)" }, { transform: "scale(.9,1.2)", offset: 0.4 }, { transform: "scale(1.08,.96)", offset: 0.7 }, { transform: "scale(1)" }], { duration: 460, easing: "ease-out" });
    }
  }, 48);
}

/** Celebration: big check + confetti + Pip cheers. */
export function celebrate(from?: Element | null) {
  const r = from?.getBoundingClientRect();
  check("big");
  confetti(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 2 : undefined);
  pip.cheer();
}
