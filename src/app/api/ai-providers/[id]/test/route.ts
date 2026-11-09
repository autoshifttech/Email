import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { testAiConfig } from "@/lib/ai";
import { handle, type Ctx } from "@/lib/api";

export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await prisma.aiProvider.findUniqueOrThrow({ where: { id } });
  const r = await testAiConfig({ name: p.name, baseUrl: p.baseUrl, model: p.model, apiKey: decrypt(p.encApiKey), source: "dashboard" });
  await prisma.aiProvider.update({ where: { id }, data: { lastTestedAt: new Date(), lastTestOk: r.ok, lastError: r.ok ? null : r.message.slice(0, 500) } });
  return NextResponse.json(r);
});
