import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, handle } from "@/lib/api";
import { parseContactsCsv } from "@/lib/csv";


export const POST = handle(async (req: Request) => {
  const d = await body(req, z.object({ csv: z.string().min(1), groupId: z.string().optional() }));
  const rows = parseContactsCsv(d.csv);
  let created = 0, updated = 0;
  for (const r of rows) {
    const existing = await prisma.contact.findUnique({ where: { email: r.email } });
    const c = existing
      ? await prisma.contact.update({ where: { id: existing.id }, data: { name: r.name || existing.name, tags: r.tags || existing.tags } })
      : await prisma.contact.create({ data: r });
    existing ? updated++ : created++;
    if (d.groupId) await prisma.groupMember.upsert({ where: { groupId_contactId: { groupId: d.groupId, contactId: c.id } }, create: { groupId: d.groupId, contactId: c.id }, update: {} });
  }
  return NextResponse.json({ created, updated, total: rows.length });
});
