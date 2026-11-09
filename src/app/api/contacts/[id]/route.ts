import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { body, handle, type Ctx } from "@/lib/api";
import { contactSchema } from "@/lib/schemas";

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const d = await body(req, contactSchema.partial());
  const { groupIds, ...rest } = d;
  const c = await prisma.$transaction(async (tx) => {
    const c = await tx.contact.update({ where: { id }, data: rest });
    if (groupIds) {
      await tx.groupMember.deleteMany({ where: { contactId: id } });
      if (groupIds.length) await tx.groupMember.createMany({ data: groupIds.map((groupId) => ({ groupId, contactId: id })) });
    }
    return c;
  });
  return NextResponse.json(c);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await prisma.contact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
