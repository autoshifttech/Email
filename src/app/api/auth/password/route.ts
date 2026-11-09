import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSession, jsonError } from "@/lib/auth";
import { body, handle } from "@/lib/api";

export const POST = handle(async (req: Request) => {
  const s = await getSession();
  if (!s) return jsonError("Unauthorized", 401);
  const d = await body(req, z.object({ current: z.string(), next: z.string().min(8, "at least 8 characters") }));
  const user = await prisma.user.findUniqueOrThrow({ where: { id: s.userId } });
  if (!(await bcrypt.compare(d.current, user.passwordHash))) return jsonError("Current password is wrong", 400);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(d.next, 12) } });
  return NextResponse.json({ ok: true });
});
