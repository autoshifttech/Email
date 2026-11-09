import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma, logActivity } from "@/lib/db";
import { encrypt, keyHint } from "@/lib/crypto";
import { body, handle } from "@/lib/api";
import { publicProvider } from "@/lib/serialize";

export const GET = handle(async () => {
  const providers = await prisma.aiProvider.findMany({ orderBy: { createdAt: "asc" } });
  const envFallback = !!(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL);
  return NextResponse.json({ providers: providers.map(publicProvider), envFallback, envModel: envFallback ? process.env.AI_MODEL : null });
});

const schema = z.object({
  name: z.string().trim().min(1).max(60),
  preset: z.string().default("custom"),
  baseUrl: z.string().trim().url(),
  model: z.string().trim().min(1),
  apiKey: z.string().default(""),
  isActive: z.boolean().default(false),
});

export const POST = handle(async (req: Request) => {
  const d = await body(req, schema);
  const makeActive = d.isActive || (await prisma.aiProvider.count({ where: { isActive: true } })) === 0;
  if (makeActive) await prisma.aiProvider.updateMany({ data: { isActive: false } });
  const p = await prisma.aiProvider.create({
    data: {
      name: d.name, preset: d.preset, baseUrl: d.baseUrl, model: d.model,
      encApiKey: encrypt(d.apiKey.trim()), keyHint: keyHint(d.apiKey.trim()), isActive: makeActive,
    },
  });
  await logActivity("ai", `Added AI provider ${p.name}`);
  return NextResponse.json(publicProvider(p), { status: 201 });
});
