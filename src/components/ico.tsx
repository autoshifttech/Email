"use client";
import type { LucideIcon } from "lucide-react";

const TONES = {
  indigo: "from-[#8b7bff] to-[#5a3df5]",
  pink: "from-[#ff9a8b] to-[#ff4d8d]",
  orange: "from-[#ffc46b] to-[#ff7a45]",
  green: "from-[#6ee7b7] to-[#10b981]",
  sky: "from-[#7dd3fc] to-[#3b82f6]",
  violet: "from-[#d8b4fe] to-[#8b5cf6]",
  white: "from-white to-[#ece9ff]",
} as const;
export type Tone = keyof typeof TONES;

/**
 * Premium icon chip: a frosted gradient tile with a crisp line icon, inner gloss
 * and soft glow. `float` makes it bob gently.
 */
export function IconChip({ icon: Icon, tone = "indigo", size = 44, float = false, className = "" }: { icon: LucideIcon; tone?: Tone; size?: number; float?: boolean; className?: string }) {
  return (
    <span
      className={`ico-chip bg-gradient-to-br ${TONES[tone]} ${float ? "float-soft" : ""} ${className}`}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.32) }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={2} color={tone === "white" ? "#2b1fb0" : "#fff"} />
    </span>
  );
}
