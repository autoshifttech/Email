import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { jsonError, rateLimit } from "@/lib/auth";
import { body, handle } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (!rateLimit(`login:${ip}`, 10, 15 * 60_000)) return jsonError("Too many attempts. Try again in 15 minutes.", 429);
  const { email, password } = await body(req, z.object({ email: z.string().email(), password: z.string().min(1) }));
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return jsonError("Invalid email or password", 401);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.email), sessionCookieOptions);
  return res;
});
