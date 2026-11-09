import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { jsonError } from "@/lib/auth";
import { body, handle } from "@/lib/api";
import { setSetting } from "@/lib/settings";

/** First-run: create the owner account. Only works while no user exists. */
export const POST = handle(async (req: Request) => {
  if ((await prisma.user.count()) > 0) return jsonError("Setup already completed", 403);
  const d = await body(req, z.object({ name: z.string().max(100).default(""), email: z.string().email(), password: z.string().min(8, "at least 8 characters") }));
  const user = await prisma.user.create({
    data: { name: d.name, email: d.email.toLowerCase(), passwordHash: await bcrypt.hash(d.password, 12) },
  });
  if (d.name) await setSetting("OWNER_NAME", d.name);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(user.id, user.email), sessionCookieOptions);
  return res;
});
