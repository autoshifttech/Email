import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { draftNew, draftReply, reviseDraft } from "@/lib/ai";
import { body, handle } from "@/lib/api";

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("reply"), emailId: z.string(), prompt: z.string().default("") }),
  z.object({ kind: z.literal("new"), prompt: z.string().min(1), subject: z.string().optional(), broadcast: z.boolean().default(false) }),
  z.object({ kind: z.literal("revise"), subject: z.string(), body: z.string(), prompt: z.string().min(1) }),
]);

/** Generate text with AI for the dashboard editors (does not save or send anything). */
export const POST = handle(async (req: Request) => {
  const d = await body(req, schema);
  if (d.kind === "reply") {
    const email = await prisma.email.findUniqueOrThrow({ where: { id: d.emailId } });
    return NextResponse.json(await draftReply(email, d.prompt));
  }
  if (d.kind === "new") return NextResponse.json(await draftNew(d.prompt, { subject: d.subject || undefined, broadcast: d.broadcast }));
  return NextResponse.json(await reviseDraft({ subject: d.subject, body: d.body }, d.prompt));
});
