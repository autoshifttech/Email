import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { body, handle } from "@/lib/api";
import { syncAccountOnce, syncAllOnce } from "@/lib/sync";

export const maxDuration = 60;

/** "Sync now" button in the dashboard (logged-in owner). */
export const POST = handle(async (req: Request) => {
  const { accountId } = await body(req, z.object({ accountId: z.string().optional() }));
  if (accountId) {
    const a = await prisma.emailAccount.findUniqueOrThrow({ where: { id: accountId } });
    return NextResponse.json({ results: [await syncAccountOnce(a)] });
  }
  return NextResponse.json({ results: await syncAllOnce() });
});
