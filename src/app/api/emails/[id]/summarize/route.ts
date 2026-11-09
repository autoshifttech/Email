import { NextResponse } from "next/server";
import { handle, type Ctx } from "@/lib/api";
import { summarizeEmail } from "@/lib/ai";
import { prisma } from "@/lib/db";

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const email = await prisma.email.findUniqueOrThrow({ where: { id } });
  const s = await summarizeEmail(email); // throws if no AI configured -> shown in UI
  const updated = await prisma.email.update({ where: { id }, data: { summary: s.summary, priority: s.priority, category: s.category } });
  return NextResponse.json(updated);
});
