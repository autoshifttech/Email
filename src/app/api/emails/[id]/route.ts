import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, logActivity } from "@/lib/db";
import { serverAction } from "@/lib/mail";
import { body, handle, type Ctx } from "@/lib/api";

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const email = await prisma.email.findUniqueOrThrow({ where: { id }, include: { account: { select: { label: true, address: true } } } });
  return NextResponse.json(email);
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const d = await body(req, z.object({ isRead: z.boolean().optional(), isArchived: z.boolean().optional() }));
  const email = await prisma.email.update({ where: { id }, data: d, include: { account: true } });
  if (d.isRead !== undefined && email.uid && email.direction === "IN") {
    serverAction(email.account, email.mailbox, email.uid, d.isRead ? "seen" : "unseen").catch(() => {});
  }
  return NextResponse.json({ ok: true });
});

/** DELETE /api/emails/:id?server=1 also deletes it from the mail server. */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const server = new URL(req.url).searchParams.get("server") === "1";
  const email = await prisma.email.findUniqueOrThrow({ where: { id }, include: { account: true } });
  if (server && email.uid && email.direction === "IN") await serverAction(email.account, email.mailbox, email.uid, "delete");
  await prisma.email.delete({ where: { id } });
  await logActivity("email", `Deleted email "${email.subject}"${server ? " (also on server)" : ""}`);
  return NextResponse.json({ ok: true });
});
