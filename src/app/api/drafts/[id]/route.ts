import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, handle, HttpError, type Ctx } from "@/lib/api";
import { splitAddresses, isEmail } from "@/lib/recipients";

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const d = await body(req, z.object({ subject: z.string().optional(), body: z.string().optional(), to: z.string().optional(), status: z.enum(["REJECTED", "PENDING_APPROVAL"]).optional() }));
  const draft = await prisma.draft.findUniqueOrThrow({ where: { id } });
  if (draft.status === "SENT" || draft.status === "SENDING") throw new HttpError(409, "Draft was already sent");
  let recipients: string | undefined;
  if (d.to !== undefined) {
    const list = splitAddresses(d.to);
    if (!list.length || list.some((x) => !isEmail(x))) throw new HttpError(400, "Invalid recipients");
    recipients = JSON.stringify(list);
  }
  const updated = await prisma.draft.update({
    where: { id },
    data: { subject: d.subject, body: d.body, status: d.status, ...(recipients ? { recipients } : {}) },
  });
  return NextResponse.json(updated);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await prisma.draft.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
