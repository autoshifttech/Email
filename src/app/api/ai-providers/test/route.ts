import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { testAiConfig } from "@/lib/ai";
import { body, handle } from "@/lib/api";

/** Test unsaved form values (blank apiKey + id = use the stored key). */
export const POST = handle(async (req: Request) => {
  const d = await body(req, z.object({ id: z.string().optional(), baseUrl: z.string().url(), model: z.string().min(1), apiKey: z.string().default("") }));
  let apiKey = d.apiKey.trim();
  if (!apiKey && d.id) apiKey = decrypt((await prisma.aiProvider.findUniqueOrThrow({ where: { id: d.id } })).encApiKey);
  return NextResponse.json(await testAiConfig({ name: "test", baseUrl: d.baseUrl, model: d.model, apiKey, source: "dashboard" }));
});
