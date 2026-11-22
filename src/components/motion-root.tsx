"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { pip, reduced } from "@/lib/fx";

const GLASS = ".btn,.circle,.mini,.chip,.pill,.day,.dock a";

/**
 * Global motion layer (mounted once):
 *  - liquid-glass lens refraction on Chromium + the touch light that follows your finger
 *  - scroll reveal for every .rv / .rise element (auto-registers new ones)
 *  - blob parallax, smooth wheel scrolling on desktop
 *  - idle detection (Pip dozes, blobs breathe), phone tilt, offline bar
 */
export function MotionRoot() {
  const path = usePathname();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // lens refraction only where backdrop-filter: url() works (Chromium)
    try {
      const b = (navigator as unknown as { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
      if (b?.some((x) => /Chromium|Chrome/i.test(x.brand))) document.documentElement.classList.add("lens");
    } catch {
      /* ignore */
    }
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(GLASS) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", (((e.clientX - r.left) / r.width) * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (((e.clientY - r.top) / r.height) * 100).toFixed(1) + "%");
    };
    document.addEventListener("pointerdown", onDown, { passive: true });

    // blob parallax
    const bg = document.querySelector(".backdrop") as HTMLElement | null;
    let tick = false;
    const onScroll = () => {
      if (tick || !bg) return;
      tick = true;
      requestAnimationFrame(() => { bg.style.setProperty("--sy", String(window.scrollY)); tick = false; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // smooth wheel scrolling (mouse users only)
    let target = 0, cur = 0, raf = 0;
    const maxY = () => Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const loop = () => {
      if (Math.abs(window.scrollY - cur) > 2) { raf = 0; return; }
      cur += (target - cur) * 0.14;
      if (Math.abs(target - cur) < 0.4) cur = target;
      window.scrollTo({ top: cur, behavior: "instant" as ScrollBehavior });
      raf = cur === target ? 0 : requestAnimationFrame(loop);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const t = e.target as Element | null;
      if (t?.closest?.("textarea, select, .modal-scroll, iframe, [data-noscroll]")) return;
      e.preventDefault();
      if (!raf) cur = target = window.scrollY;
      target = Math.max(0, Math.min(maxY(), target + e.deltaY * (e.deltaMode === 1 ? 32 : 1)));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const smooth = !reduced() && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (smooth) window.addEventListener("wheel", onWheel, { passive: false });

    // idle: after 25s without input Pip dozes and the blobs breathe
    let lastIn = performance.now(), asleep = false;
    const poke = () => {
      lastIn = performance.now();
      if (asleep) { asleep = false; document.body.classList.remove("is-idle"); window.dispatchEvent(new Event("mb:wake")); }
    };
    const idleT = setInterval(() => {
      if (!asleep && !document.hidden && performance.now() - lastIn > 25000) {
        asleep = true;
        document.body.classList.add("is-idle");
        window.dispatchEvent(new Event("mb:sleep"));
      }
    }, 2000);
    const evs = ["pointermove", "pointerdown", "keydown", "scroll"] as const;
    evs.forEach((ev) => window.addEventListener(ev, poke, { passive: true }));

    // tilt the phone: the summary card sways a little and Pip's eyes follow
    let tx = 0, ty = 0;
    const ori = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || reduced()) return;
      const gx = Math.max(-25, Math.min(25, e.gamma)), gy = Math.max(-25, Math.min(25, (e.beta || 45) - 45));
      tx += ((-gy / 25) * 2.5 - tx) * 0.25;
      ty += ((gx / 25) * 3 - ty) * 0.25;
      const s = document.documentElement.style;
      s.setProperty("--tx", tx.toFixed(2) + "deg");
      s.setProperty("--ty", ty.toFixed(2) + "deg");
      document.body.classList.add("tilt");
      window.dispatchEvent(new CustomEvent("mb:look", { detail: { x: innerWidth / 2 + gx * 14, y: innerHeight / 2 + gy * 10 } }));
    };
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    let onceAsk: (() => void) | null = null;
    if (DOE) {
      if (typeof DOE.requestPermission === "function") {
        onceAsk = () => {
          document.removeEventListener("pointerdown", onceAsk!);
          DOE.requestPermission!().then((r) => { if (r === "granted") window.addEventListener("deviceorientation", ori); }).catch(() => {});
        };
        document.addEventListener("pointerdown", onceAsk);
      } else window.addEventListener("deviceorientation", ori);
    }

    // offline bar
    const on = () => setOffline(false), off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    if (!navigator.onLine) setOffline(true);

    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
      if (smooth) window.removeEventListener("wheel", onWheel);
      evs.forEach((ev) => window.removeEventListener(ev, poke));
      clearInterval(idleT);
      window.removeEventListener("deviceorientation", ori);
      if (onceAsk) document.removeEventListener("pointerdown", onceAsk);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // scroll reveal: every .rv / .rise element fades + rises in as it enters the viewport (staggered)
  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".rv,.rise").forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      let n = 0;
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        (en.target as HTMLElement).style.setProperty("--d", Math.min(n++, 8) * 45 + "ms");
        en.target.classList.add("in");
        io.unobserve(en.target);
      });
    }, { threshold: 0.05, rootMargin: "0px 0px -6% 0px" });
    const scan = (root: ParentNode) => root.querySelectorAll?.(".rv:not(.in),.rise:not(.in)").forEach((el) => io.observe(el));
    scan(document);
    const mo = new MutationObserver((ms) => {
      ms.forEach((m) => m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches(".rv:not(.in),.rise:not(.in)")) io.observe(n);
        scan(n);
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  // a little hello from Pip on every page change
  useEffect(() => { pip.react("wink", "happy", 600); }, [path]);

  return (
    <>
      {/* liquid glass lens + shared gradients */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
        <filter id="lg-lens" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feImage
            href="data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='100'%20height='100'%3E%3Cdefs%3E%3ClinearGradient%20id='x'%20x1='0'%20x2='1'%20y1='0'%20y2='0'%3E%3Cstop%20offset='0'%20stop-color='%23ff0000'/%3E%3Cstop%20offset='.28'%20stop-color='%23800000'/%3E%3Cstop%20offset='.72'%20stop-color='%23800000'/%3E%3Cstop%20offset='1'%20stop-color='%23000000'/%3E%3C/linearGradient%3E%3ClinearGradient%20id='y'%20x1='0'%20x2='0'%20y1='0'%20y2='1'%3E%3Cstop%20offset='0'%20stop-color='%2300ff00'/%3E%3Cstop%20offset='.28'%20stop-color='%23008000'/%3E%3Cstop%20offset='.72'%20stop-color='%23008000'/%3E%3Cstop%20offset='1'%20stop-color='%23000000'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect%20width='100'%20height='100'%20fill='%23000'/%3E%3Crect%20width='100'%20height='100'%20fill='url(%23x)'/%3E%3Crect%20width='100'%20height='100'%20fill='url(%23y)'%20style='mix-blend-mode:screen'/%3E%3C/svg%3E"
            x="0" y="0" width="100%" height="100%" preserveAspectRatio="none" result="map"
          />
          <feDisplacementMap in="SourceGraphic" in2="map" scale="26" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <defs>
          <linearGradient id="og" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb23d" /><stop offset="1" stopColor="#ee6a00" /></linearGradient>
        </defs>
      </svg>
      <div className={`offbar ${offline ? "show" : ""}`} role="status">You&apos;re offline. Changes will fail until you reconnect.</div>
    </>
  );
}
