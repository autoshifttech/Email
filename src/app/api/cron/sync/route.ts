import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getSyncSecret } from "@/lib/settings";
import { syncAllOnce } from "@/lib/sync";
import { rateLimit } from "@/lib/auth";

// Serverless hosts (Vercel) can't keep the IMAP worker running, so a scheduler
// (cron-job.org, Vercel Cron, GitHub Actions…) calls this URL every few minutes.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

async function run(req: Request) {
  if (!rateLimit("cron-sync", 30, 60_000)) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const given = url.searchParams.get("key") ?? bearer;
  const secret = await getSyncSecret();
  if (!given || !safeEqual(given, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await syncAllOnce({ maxEmails: Number(process.env.SYNC_MAX_EMAILS ?? 10) });
  return NextResponse.json({ ok: true, at: new Date().toISOString(), results });
}

export const GET = run;
export const POST = run;
