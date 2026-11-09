import { NextResponse } from "next/server";
import { prisma, logActivity } from "@/lib/db";
import { handle, type Ctx } from "@/lib/api";

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  await prisma.$transaction([
    prisma.aiProvider.updateMany({ data: { isActive: false } }),
    prisma.aiProvider.update({ where: { id }, data: { isActive: true } }),
  ]);
  const p = await prisma.aiProvider.findUniqueOrThrow({ where: { id } });
  await logActivity("ai", `Active AI provider is now ${p.name} (${p.model})`);
  return NextResponse.json({ ok: true });
});
