import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/api";
import { getInsights } from "@/lib/stats";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  const date = u.get("date") ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "date must be YYYY-MM-DD");
  const tz = Number(u.get("tz") ?? 0);
  return NextResponse.json(await getInsights(date, Number.isFinite(tz) ? Math.max(-840, Math.min(840, tz)) : 0));
});
