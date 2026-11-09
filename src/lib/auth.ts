import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./session";

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Simple in-memory rate limiter (per process). */
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  b.count++;
  return b.count <= limit;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}
