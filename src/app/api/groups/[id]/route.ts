import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { body, handle, type Ctx } from "@/lib/api";
import { groupSchema } from "@/lib/schemas";

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const d = await body(req, groupSchema.partial());
  const { contactIds, ...rest } = d;
  const g = await prisma.$transaction(async (tx) => {
    const g = await tx.group.update({ where: { id }, data: rest });
    if (contactIds) {
      await tx.groupMember.deleteMany({ where: { groupId: id } });
      if (contactIds.length) await tx.groupMember.createMany({ data: contactIds.map((contactId) => ({ groupId: id, contactId })) });
    }
    return g;
  });
  return NextResponse.json(g);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await prisma.group.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
