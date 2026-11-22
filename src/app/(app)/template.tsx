"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { dockIndex } from "@/components/nav";

let lastIdx: number | null = null;

/** iPhone-style page change: the new page slides in from the side the dock order points to. */
export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const idx = dockIndex(path);
  const cls = lastIdx === null ? "xf-zoom" : idx > lastIdx ? "xf-fwd" : idx < lastIdx ? "xf-back" : "xf-zoom";
  useEffect(() => { lastIdx = idx; }, [idx]);
  return <div className={cls}>{children}</div>;
}
