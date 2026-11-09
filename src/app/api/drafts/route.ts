import { NextResponse, after } from "next/server";
import { z } from "zod";
import { prisma, logActivity } from "@/lib/db";
import { body, handle, HttpError } from "@/lib/api";
import { resolveTarget, splitAddresses, isEmail } from "@/lib/recipients";
import { sendDraft } from "@/lib/send";

export const GET = handle(async (req: Request) => {
  const status = new URL(req.url).searchParams.get("status");
  const drafts = await prisma.draft.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { account: { select: { label: true, address: true } }, replyToEmail: { select: { subject: true, fromAddress: true } } },
  });
  return NextResponse.json(drafts);
});

const schema = z.object({
  accountId: z.string(),
  target: z.enum(["emails", "group", "all"]).default("emails"),
  to: z.string().default(""), // comma separated (target=emails)
  groupId: z.string().optional(),
  replyToEmailId: z.string().optional(),
  subject: z.string().min(1, "required"),
  body: z.string().min(1, "required"),
  prompt: z.string().optional(),
  author: z.enum(["AI", "MANUAL"]).default("MANUAL"),
  sendNow: z.boolean().default(false),
});

/** Create a draft from the dashboard (compose or reply). sendNow=true sends immediately. */
export const POST = handle(async (req: Request) => {
  const d = await body(req, schema);
  let recipients: string[] = [];
  let mode = "NEW";
  if (d.target === "all") {
    recipients = (await resolveTarget("all")).emails;
    mode = "BROADCAST";
  } else if (d.target === "group") {
    const g = await prisma.group.findUniqueOrThrow({ where: { id: d.groupId ?? "" } });
    recipients = (await resolveTarget(g.name)).emails;
    mode = "BROADCAST";
  } else {
    recipients = splitAddresses(d.to);
    const bad = recipients.filter((r) => !isEmail(r));
    if (bad.length) throw new HttpError(400, `Invalid email address: ${bad.join(", ")}`);
    if (d.replyToEmailId) mode = "REPLY";
  }
  if (!recipients.length) throw new HttpError(400, "No recipients");
  const draft = await prisma.draft.create({
    data: {
      accountId: d.accountId,
      replyToEmailId: d.replyToEmailId ?? null,
      groupId: d.groupId ?? null,
      mode,
      recipients: JSON.stringify(recipients),
      subject: d.subject,
      body: d.body,
      prompt: d.prompt ?? null,
      author: d.author,
      origin: "DASHBOARD",
    },
  });
  if (!d.sendNow) {
    await logActivity("draft", `Saved draft "${d.subject}"`);
    return NextResponse.json({ draft, queued: false }, { status: 201 });
  }
  if (mode === "BROADCAST" && recipients.length > 3) {
    // Large broadcasts continue in the background; the Drafts page shows progress.
    after(() => sendDraft(draft.id).then(() => undefined).catch(() => undefined));
    return NextResponse.json({ draft, queued: true }, { status: 202 });
  }
  const result = await sendDraft(draft.id);
  if (!result.ok) throw new HttpError(502, result.errors.join("; "));
  return NextResponse.json({ draft, result }, { status: 201 });
});
