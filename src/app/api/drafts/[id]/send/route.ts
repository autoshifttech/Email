import { NextResponse, after } from "next/server";
import { prisma } from "@/lib/db";
import { handle, HttpError, type Ctx } from "@/lib/api";
import { sendDraft, draftRecipients } from "@/lib/send";

/** Approve & send a draft. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const draft = await prisma.draft.findUniqueOrThrow({ where: { id } });
  if (draft.mode === "BROADCAST" && draftRecipients(draft).length > 3) {
    after(() => sendDraft(id).then(() => undefined).catch(() => undefined));
    return NextResponse.json({ queued: true }, { status: 202 });
  }
  const result = await sendDraft(id);
  if (!result.ok) throw new HttpError(502, result.errors.join("; "));
  return NextResponse.json({ result });
});
