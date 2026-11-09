import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, logActivity } from "@/lib/db";
import { encrypt, keyHint } from "@/lib/crypto";
import { body, handle, type Ctx } from "@/lib/api";
import { publicProvider } from "@/lib/serialize";

const schema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  preset: z.string().optional(),
  baseUrl: z.string().trim().url().optional(),
  model: z.string().trim().min(1).optional(),
  apiKey: z.string().optional(), // blank/undefined = keep existing key
  clearKey: z.boolean().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { apiKey, clearKey, ...rest } = await body(req, schema);
  const keyData = clearKey
    ? { encApiKey: "", keyHint: "" }
    : apiKey?.trim()
      ? { encApiKey: encrypt(apiKey.trim()), keyHint: keyHint(apiKey.trim()), lastTestOk: null, lastError: null }
      : {};
  const p = await prisma.aiProvider.update({ where: { id }, data: { ...rest, ...keyData } });
  return NextResponse.json(publicProvider(p));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const p = await prisma.aiProvider.delete({ where: { id } });
  if (p.isActive) {
    const next = await prisma.aiProvider.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) await prisma.aiProvider.update({ where: { id: next.id }, data: { isActive: true } });
  }
  await logActivity("ai", `Deleted AI provider ${p.name}`);
  return NextResponse.json({ ok: true });
});
