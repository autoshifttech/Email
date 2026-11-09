import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { body, handle, HttpError } from "@/lib/api";
import { groupSchema } from "@/lib/schemas";


export const GET = handle(async () => {
  const groups = await prisma.group.findMany({ orderBy: { name: "asc" }, include: { members: { select: { contactId: true } } } });
  return NextResponse.json(groups.map((g) => ({ ...g, contactIds: g.members.map((m) => m.contactId), memberCount: g.members.length })));
});

export const POST = handle(async (req: Request) => {
  const d = await body(req, groupSchema);
  if (await prisma.group.findUnique({ where: { name: d.name } })) throw new HttpError(409, "A group with this name already exists");
  const g = await prisma.group.create({
    data: { name: d.name, description: d.description, members: d.contactIds?.length ? { create: d.contactIds.map((contactId) => ({ contactId })) } : undefined },
  });
  return NextResponse.json(g, { status: 201 });
});
