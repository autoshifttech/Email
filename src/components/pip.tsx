"use client";
import { useEffect, useRef } from "react";
import { anim, vib } from "@/lib/fx";

export type PipMood = "happy" | "ok" | "worried" | "sad";

const MOUTH: Record<string, [string, boolean]> = {
  happy: ["M36 39 Q42 46 48 39", false], ok: ["M37 41 Q42 44 47 41", false], worried: ["M36 44 Q42 38 48 44", false],
  sad: ["M35 45 Q42 37 49 45", false], sleep: ["M39 41 Q42 44 45 41", false],
  grin: ["M35 36 Q42 49 49 36 Z", true], gasp: ["M39 38 Q42 48 45 38 Q42 35 39 38 Z", true],
};

/** Pip's face only (for toasts and small places). */
export function PipFace({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 84 50" className={className} aria-hidden>
      <defs><linearGradient id="pipF" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stopColor="#ffbe55" /><stop offset="1" stopColor="#ee6a00" /></linearGradient></defs>
      <path d="M7 50 C7 24 21 8 42 8 C63 8 77 24 77 50 Z" fill="url(#pipF)" />
      <ellipse cx="32" cy="29" rx="7.2" ry="8.2" fill="#fff" /><circle cx="32" cy="30" r="3.9" fill="#1c1c20" />
      <ellipse cx="52" cy="29" rx="7.2" ry="8.2" fill="#fff" /><circle cx="52" cy="30" r="3.9" fill="#1c1c20" />
      <path d="M36 39 Q42 46 48 39" fill="none" stroke="#7a2e00" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The mascot that peeks over the summary card. Blinks, follows the pointer,
 * dozes when idle, wears sunglasses by day and a nightcap at night, swings with
 * scroll speed, flaps its mouth while a toast talks, and reacts to app events.
 */
export function Pip({ mood = "happy" }: { mood?: PipMood }) {
  const ref = useRef<HTMLDivElement>(null);
  const moodRef = useRef<PipMood>(mood);

  useEffect(() => {
    moodRef.current = mood;
    const el = ref.current;
    if (!el || el.dataset.mood === "sleep") return;
    el.dataset.mood = mood;
    setMouth(el, mood, false);
  }, [mood]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const svg = el.querySelector("svg") as SVGSVGElement;
    const pupils = el.querySelectorAll<SVGElement>(".pupil,.shine");
    let reactT = 0, asleep = false, raf = 0, tx = 0, ty = 0;
    const timers: number[] = [];
    const later = (fn: () => void, ms: number) => { const t = window.setTimeout(fn, ms); timers.push(t); return t; };

    const restMouth = () => setMouth(el, asleep ? "sleep" : moodRef.current, true);
    const react = (name: string, mouthKey: string, ms = 900) => {
      clearTimeout(reactT);
      el.dataset.react = name;
      setMouth(el, mouthKey, true);
      reactT = later(() => { reactT = 0; delete el.dataset.react; restMouth(); }, ms);
    };
    const hop = (big = false) =>
      anim(el, [
        { transform: "translateY(0) scale(1,1)" }, { transform: "translateY(0) scale(1.14,.8)", offset: 0.18 },
        { transform: `translateY(-${big ? 22 : 14}px) scale(.9,1.16)`, offset: 0.45 }, { transform: "translateY(0) scale(1.12,.86)", offset: 0.7 },
        { transform: "translateY(-3px) scale(.98,1.03)", offset: 0.86 }, { transform: "translateY(0) scale(1,1)" },
      ], { duration: big ? 760 : 620, easing: "ease-out" });
    const cheer = () => { hop(true); react("cheer", "grin", 1500); };
    const dance = () => {
      anim(el, [
        { transform: "translateY(0) rotate(0deg)" }, { transform: "translateY(-12px) rotate(-10deg) scale(.95,1.1)" },
        { transform: "translateY(0) rotate(0deg) scale(1.1,.9)" }, { transform: "translateY(-12px) rotate(10deg) scale(.95,1.1)" },
        { transform: "translateY(0) rotate(0deg) scale(1.1,.9)" }, { transform: "translateY(0) rotate(0deg)" },
      ], { duration: 960, iterations: 2, easing: "ease-in-out" });
      react("cheer", "grin", 2000);
    };

    // eyes follow the pointer / tilt
    const aim = () => {
      raf = 0;
      if (asleep) return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const ex = r.left + r.width * 0.5, ey = r.top + r.height * 0.58;
      const dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 110) * 3;
      const x = ((dx / d) * k).toFixed(2), y = ((dy / d) * k * 1.1).toFixed(2);
      pupils.forEach((p) => (p.style.transform = `translate(${x}px,${y}px)`));
    };
    const look = (x: number, y: number) => { tx = x; ty = y; if (!raf) raf = requestAnimationFrame(aim); };
    const onMove = (e: PointerEvent) => look(e.clientX, e.clientY);
    const onLook = (e: Event) => { const d = (e as CustomEvent).detail; look(d.x, d.y); };

    // idle sleep / wake
    const onSleep = () => { asleep = true; el.dataset.mood = "sleep"; setMouth(el, "sleep", true); pupils.forEach((p) => (p.style.transform = "")); };
    const onWake = () => { asleep = false; el.dataset.mood = moodRef.current; react("gasp", "gasp", 700); hop(false); };

    // blinking
    const blink = () => {
      if (!asleep && !document.hidden) {
        el.classList.add("blink");
        later(() => el.classList.remove("blink"), 150);
        if (Math.random() < 0.22) later(() => { el.classList.add("blink"); later(() => el.classList.remove("blink"), 140); }, 330);
      }
      later(blink, 2400 + Math.random() * 3200);
    };
    later(blink, 2000);

    // costumes by time of day
    const tm = () => { const h = new Date().getHours(); el.dataset.tm = h >= 11 && h < 16 ? "day" : h >= 21 || h < 5 ? "night" : ""; };
    tm();
    const tmI = window.setInterval(tm, 60000);

    // pendulum: swings with scroll speed and settles with a wobble
    let ang = 0, vel = 0, run = false, lastSY = window.scrollY;
    const swing = () => {
      vel += -0.12 * ang - 0.1 * vel;
      ang += vel;
      svg.style.rotate = ang.toFixed(2) + "deg";
      if (Math.abs(ang) > 0.05 || Math.abs(vel) > 0.05) requestAnimationFrame(swing);
      else { run = false; svg.style.rotate = ""; }
    };
    const onScroll = () => {
      const y = window.scrollY, dy = y - lastSY;
      lastSY = y;
      vel += Math.max(-3, Math.min(3, dy * -0.05));
      if (!run) { run = true; requestAnimationFrame(swing); }
    };

    // mouth flaps while a toast is talking
    let flap = 0;
    const onToast = () => {
      if (flap || asleep) return;
      const mouth = el.querySelector(".mouth")!;
      let o = 0;
      flap = window.setInterval(() => {
        o ^= 1;
        mouth.setAttribute("d", o ? "M37 38 Q42 48 47 38 Z" : "M37 41 Q42 43 47 41");
        mouth.setAttribute("fill", o ? "#7a2e00" : "none");
      }, 130);
      later(() => { clearInterval(flap); flap = 0; restMouth(); }, 1400);
    };

    // commands from anywhere in the app
    const onCmd = (e: Event) => {
      const c = (e as CustomEvent).detail;
      if (asleep) onWake();
      if (c.kind === "react") react(c.name, c.mouth, c.ms);
      else if (c.kind === "hop") hop(c.big);
      else if (c.kind === "cheer") cheer();
      else if (c.kind === "dance") dance();
      else if (c.kind === "stretch") {
        el.style.transition = c.amount ? "none" : "scale .45s cubic-bezier(.34,1.8,.5,1)";
        el.style.scale = c.amount ? `1 ${(1 + Math.min(c.amount, 1) * 0.4).toFixed(3)}` : "";
      }
    };

    // tap Pip
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      if (asleep) { onWake(); return; }
      hop(true);
      react("wink", "grin", 900);
      vib(10);
    };

    // intro: pops up from behind the card, then waves
    anim(el, [
      { transform: "translateY(54px) scale(.8,1.2)", opacity: 0 }, { transform: "translateY(-18px) scale(.92,1.15)", opacity: 1, offset: 0.5 },
      { transform: "translateY(0) scale(1.12,.86)", offset: 0.72 }, { transform: "translateY(0) scale(1,1)", opacity: 1 },
    ], { duration: 950, delay: 350, fill: "backwards", easing: "ease-out" });
    later(() => react("cheer", "grin", 1100), 1500);

    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerdown", onMove, { passive: true });
    window.addEventListener("mb:look", onLook);
    window.addEventListener("mb:sleep", onSleep);
    window.addEventListener("mb:wake", onWake);
    window.addEventListener("mb:toast", onToast);
    window.addEventListener("mb:pip", onCmd);
    window.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("click", onClick);
    if (document.body.classList.contains("is-idle")) onSleep();
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(tmI);
      clearInterval(flap);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerdown", onMove);
      window.removeEventListener("mb:look", onLook);
      window.removeEventListener("mb:sleep", onSleep);
      window.removeEventListener("mb:wake", onWake);
      window.removeEventListener("mb:toast", onToast);
      window.removeEventListener("mb:pip", onCmd);
      window.removeEventListener("scroll", onScroll);
      el.removeEventListener("click", onClick);
    };
  }, []);

  return (
    <div ref={ref} className="pip" data-mood={mood} role="img" aria-label="Pip, your inbox buddy">
      <svg viewBox="0 0 84 50" focusable="false">
        <defs><linearGradient id="pipG" x1="0" y1="0" x2=".4" y2="1"><stop offset="0" stopColor="#ffbe55" /><stop offset="1" stopColor="#ee6a00" /></linearGradient></defs>
        <g className="ant">
          <path d="M42 9 C41 3 45 0 49 2" fill="none" stroke="#c25200" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="49.5" cy="2.5" r="3" fill="#ffd43d" stroke="#c25200" strokeWidth="1.4" />
        </g>
        <path d="M7 50 C7 24 21 8 42 8 C63 8 77 24 77 50 Z" fill="url(#pipG)" />
        <path d="M15 30 C17 21 24 15 33 13" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="40" r="4.2" fill="#ff6b6b" fillOpacity=".38" /><circle cx="63" cy="40" r="4.2" fill="#ff6b6b" fillOpacity=".38" />
        <g className="eyes">
          <g className="eye"><ellipse cx="32" cy="29" rx="7.2" ry="8.2" fill="#fff" /><circle className="pupil" cx="32" cy="30" r="3.9" fill="#1c1c20" /><circle className="shine" cx="33.4" cy="28" r="1.2" fill="#fff" /></g>
          <g className="eye"><ellipse cx="52" cy="29" rx="7.2" ry="8.2" fill="#fff" /><circle className="pupil" cx="52" cy="30" r="3.9" fill="#1c1c20" /><circle className="shine" cx="53.4" cy="28" r="1.2" fill="#fff" /></g>
        </g>
        <path className="mouth" d={MOUTH[mood][0]} fill="none" stroke="#7a2e00" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path className="sweat" d="M70 17 C67 22 67 25 70 25 C73 25 73 22 70 17 Z" fill="#8fc7ff" stroke="#fff" strokeWidth=".8" />
        <g className="hand hl"><rect x="3" y="41" width="13" height="9" rx="4.5" fill="#ffb23d" stroke="#fff" strokeOpacity=".7" /></g>
        <g className="hand hr"><rect x="68" y="41" width="13" height="9" rx="4.5" fill="#ffb23d" stroke="#fff" strokeOpacity=".7" /></g>
        <g className="zz"><text x="60" y="14">z</text><text x="64" y="10">z</text><text x="68" y="6">z</text></g>
        <g className="cos sun">
          <rect x="22" y="22" width="19" height="13" rx="5" fill="#1c1c20" /><rect x="43" y="22" width="19" height="13" rx="5" fill="#1c1c20" />
          <path d="M41 27h2" stroke="#1c1c20" strokeWidth="2" /><path d="M25 25l6-1" stroke="#fff" strokeOpacity=".5" strokeLinecap="round" strokeWidth="1.5" />
        </g>
        <g className="cos cap">
          <path d="M14 22 C18 6 40 -2 62 6 C54 8 40 12 30 22 Z" fill="#5b7cff" />
          <path d="M12 24 Q36 14 64 8" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="66" cy="8" r="4.5" fill="#fff" />
        </g>
      </svg>
      <i className="mag" aria-hidden>🔍</i>
    </div>
  );
}

function setMouth(el: HTMLElement, key: string, popIt: boolean) {
  const m = MOUTH[key];
  const mouth = el.querySelector(".mouth");
  if (!m || !mouth) return;
  mouth.setAttribute("d", m[0]);
  mouth.setAttribute("fill", m[1] ? "#7a2e00" : "none");
  if (popIt) { mouth.classList.remove("pop"); void (mouth as SVGElement).getBoundingClientRect(); mouth.classList.add("pop"); }
}
