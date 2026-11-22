import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handle, HttpError } from "@/lib/api";
import { dayWindow } from "@/lib/email-query";

/** GET /api/days?from=YYYY-MM-DD&days=7&tz=-330 → received-email counts per local day (for the week strip dots). */
export const GET = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const from = u.get("from") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new HttpError(400, "from must be YYYY-MM-DD");
  const days = Math.min(31, Math.max(1, Number(u.get("days") ?? 7)));
  const tz = Math.max(-840, Math.min(840, Number(u.get("tz") ?? 0) || 0));
  const { start } = dayWindow(from, tz);
  const end = new Date(start.getTime() + days * 864e5);
  const rows = await prisma.email.findMany({ where: { direction: "IN", receivedAt: { gte: start, lt: end } }, select: { receivedAt: true } });
  const counts = Array.from({ length: days }, () => 0);
  for (const r of rows) counts[Math.floor((r.receivedAt.getTime() - start.getTime()) / 864e5)]++;
  return NextResponse.json({ from, counts });
});
