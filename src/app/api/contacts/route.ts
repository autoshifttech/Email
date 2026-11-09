import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { body, handle, HttpError } from "@/lib/api";
import { contactSchema } from "@/lib/schemas";


export const GET = handle(async () => {
  const contacts = await prisma.contact.findMany({ orderBy: { name: "asc" }, include: { groups: { include: { group: { select: { id: true, name: true } } } } } });
  return NextResponse.json(contacts.map((c) => ({ ...c, groups: c.groups.map((g) => g.group) })));
});

export const POST = handle(async (req: Request) => {
  const d = await body(req, contactSchema);
  if (await prisma.contact.findUnique({ where: { email: d.email } })) throw new HttpError(409, "A contact with this email already exists");
  const c = await prisma.contact.create({
    data: { name: d.name, email: d.email, tags: d.tags, groups: d.groupIds?.length ? { create: d.groupIds.map((groupId) => ({ groupId })) } : undefined },
  });
  return NextResponse.json(c, { status: 201 });
});
