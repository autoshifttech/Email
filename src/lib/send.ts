import type { Draft } from "@prisma/client";
import { prisma, logActivity } from "./db";
import { sendMail } from "./mail";
import { personalize } from "./recipients";
import { errMsg } from "./auth";

export function draftRecipients(d: Pick<Draft, "recipients">): string[] {
  try {
    const v = JSON.parse(d.recipients);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type SendResult = { ok: boolean; sent: number; failed: number; errors: string[] };

/**
 * Sends an approved draft. REPLY/NEW go out as one email; BROADCAST sends one
 * email per recipient (nobody sees the other recipients) with {{name}} personalised.
 */
export async function sendDraft(draftId: string, opts: { onProgress?: (sent: number, total: number) => void } = {}): Promise<SendResult> {
  // Atomically claim the draft so a double-click / duplicate webhook can't send twice.
  const claimed = await prisma.draft.updateMany({
    where: { id: draftId, status: { in: ["PENDING_APPROVAL", "FAILED"] } },
    data: { status: "SENDING", error: null },
  });
  if (claimed.count === 0) {
    const d = await prisma.draft.findUnique({ where: { id: draftId } });
    throw new Error(d ? `Draft is already ${d.status.toLowerCase().replace("_", " ")}.` : "Draft not found.");
  }
  const draft = await prisma.draft.findUniqueOrThrow({ where: { id: draftId }, include: { account: true, replyToEmail: true } });
  const recipients = draftRecipients(draft);
  if (!recipients.length) {
    await prisma.draft.update({ where: { id: draftId }, data: { status: "FAILED", error: "No recipients" } });
    return { ok: false, sent: 0, failed: 0, errors: ["No recipients"] };
  }
  const signature = draft.account.signature ? `\n\n${draft.account.signature}` : "";
  const errors: string[] = [];
  let sent = 0;

  const record = async (to: string[], body: string, messageId: string) => {
    await prisma.email.create({
      data: {
        accountId: draft.accountId,
        direction: "OUT",
        messageId,
        inReplyTo: draft.replyToEmail?.messageId ?? null,
        fromName: draft.account.displayName,
        fromAddress: draft.account.address,
        to: to.join(", "),
        subject: draft.subject,
        text: body,
        snippet: body.replace(/\s+/g, " ").slice(0, 200),
        isRead: true,
        receivedAt: new Date(),
      },
    });
  };

  if (draft.mode === "BROADCAST") {
    const contacts = await prisma.contact.findMany({ where: { email: { in: recipients } } });
    const names = new Map(contacts.map((c) => [c.email, c.name]));
    for (const [i, to] of recipients.entries()) {
      const body = personalize(draft.body, names.get(to)) + signature;
      try {
        const id = await sendMail(draft.account, { to: [to], subject: draft.subject, text: body });
        await record([to], body, id);
        sent++;
      } catch (e) {
        errors.push(`${to}: ${errMsg(e)}`);
      }
      await prisma.draft.update({ where: { id: draftId }, data: { sentCount: sent } });
      opts.onProgress?.(sent, recipients.length);
      if (i < recipients.length - 1) await sleep(Number(process.env.BROADCAST_DELAY_MS ?? 1200));
    }
  } else {
    const body = draft.body + signature;
    try {
      const id = await sendMail(draft.account, {
        to: recipients,
        subject: draft.subject,
        text: body,
        inReplyTo: draft.replyToEmail?.messageId,
        references: draft.replyToEmail?.references,
      });
      await record(recipients, body, id);
      sent = recipients.length;
      if (draft.replyToEmailId) await prisma.email.update({ where: { id: draft.replyToEmailId }, data: { isRead: true } });
    } catch (e) {
      errors.push(errMsg(e));
    }
  }

  const ok = sent > 0;
  await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: ok ? "SENT" : "FAILED",
      sentCount: sent,
      sentAt: ok ? new Date() : null,
      error: errors.length ? errors.join("\n").slice(0, 2000) : null,
    },
  });
  await logActivity(ok ? "send" : "error", `${ok ? "Sent" : "Failed to send"} "${draft.subject}" to ${sent}/${recipients.length} recipient(s)`);
  return { ok, sent, failed: recipients.length - sent, errors };
}
