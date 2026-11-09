import type { Draft, Email, EmailAccount } from "@prisma/client";
import { prisma, logActivity } from "./db";
import { getSettings } from "./settings";
import { REENGAGEMENT_CODES, WhatsAppError, isWhatsAppConfigured, sendButtons, sendTemplate, sendText } from "./whatsapp";
import { draftRecipients } from "./send";
import { errMsg } from "./auth";

const PRIORITY_RANK: Record<string, number> = { low: 0, normal: 1, high: 2, urgent: 3 };
const PRIORITY_ICON: Record<string, string> = { low: "⚪", normal: "🔵", high: "🟠", urgent: "🔴" };

function inQuietHours(start: string, end: string, tz: string): boolean {
  if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) return false;
  let hhmm: string;
  try {
    hhmm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
  } catch {
    hhmm = new Date().toISOString().slice(11, 16);
  }
  const toMin = (s: string) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  const now = toMin(hhmm), s = toMin(start), e = toMin(end);
  return s <= e ? now >= s && now < e : now >= s || now < e;
}

export function formatEmailCard(email: Email, account: Pick<EmailAccount, "label" | "address">) {
  const p = email.priority ?? "normal";
  const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
  return (
    `${PRIORITY_ICON[p] ?? "🔵"} *New email* · ${account.label}\n` +
    `*From:* ${from}\n*Subject:* ${email.subject}\n\n` +
    `*Summary:* ${email.summary ?? email.snippet}\n\n` +
    `_Swipe-reply to this message with instructions for an AI reply, or "reply: <text>" to send your exact words._`
  );
}

/** Should this email trigger a WhatsApp notification? */
export async function shouldNotify(email: Email, account: EmailAccount, force = false) {
  if (force) return { ok: true, reason: "" };
  if (!account.notifyOnWhatsApp) return { ok: false, reason: "notifications disabled for account" };
  const s = await getSettings(["WA_NOTIFICATIONS_ENABLED", "NOTIFY_MIN_PRIORITY", "QUIET_HOURS_START", "QUIET_HOURS_END", "TIMEZONE"] as const);
  if (s.WA_NOTIFICATIONS_ENABLED === "false") return { ok: false, reason: "notifications disabled" };
  if ((PRIORITY_RANK[email.priority ?? "normal"] ?? 1) < (PRIORITY_RANK[s.NOTIFY_MIN_PRIORITY] ?? 0))
    return { ok: false, reason: "below minimum priority" };
  if (email.priority !== "urgent" && inQuietHours(s.QUIET_HOURS_START, s.QUIET_HOURS_END, s.TIMEZONE))
    return { ok: false, reason: "quiet hours" };
  return { ok: true, reason: "" };
}

/** Send the email summary card to the owner's WhatsApp. */
export async function notifyEmail(emailId: string, opts: { force?: boolean } = {}) {
  const email = await prisma.email.findUnique({ where: { id: emailId }, include: { account: true } });
  if (!email) throw new Error("Email not found");
  if (!(await isWhatsAppConfigured())) return { sent: false, reason: "WhatsApp not configured" };
  const check = await shouldNotify(email, email.account, opts.force);
  if (!check.ok) return { sent: false, reason: check.reason };

  const buttons = [
    { id: `ai:${email.id}`, title: "🤖 Reply with AI" },
    { id: `manual:${email.id}`, title: "✍️ Reply myself" },
    { id: `ignore:${email.id}`, title: "🙈 Ignore" },
  ];
  let waId: string;
  try {
    waId = await sendButtons(formatEmailCard(email, email.account), buttons);
  } catch (e) {
    if (e instanceof WhatsAppError && e.code && REENGAGEMENT_CODES.includes(e.code)) {
      // Outside the 24h window: use the approved template.
      const s = await getSettings(["WA_TEMPLATE_NAME", "WA_TEMPLATE_LANG"] as const);
      const from = email.fromName ? `${email.fromName} <${email.fromAddress}>` : email.fromAddress;
      try {
        waId = await sendTemplate(s.WA_TEMPLATE_NAME, s.WA_TEMPLATE_LANG, [from, email.subject, email.summary ?? email.snippet]);
      } catch (e2) {
        await logActivity("error", `WhatsApp template failed: ${errMsg(e2)}`);
        throw e2;
      }
    } else {
      await logActivity("error", `WhatsApp notify failed: ${errMsg(e)}`);
      throw e;
    }
  }
  await prisma.email.update({ where: { id: email.id }, data: { waMessageId: waId, notifiedAt: new Date() } });
  return { sent: true, reason: "", waMessageId: waId };
}

/** Send a draft preview with Send / Edit / Cancel buttons. */
export async function sendDraftPreview(draft: Draft & { account: EmailAccount }) {
  const recipients = draftRecipients(draft);
  const to =
    recipients.length <= 3 ? recipients.join(", ") : `${recipients.slice(0, 3).join(", ")} +${recipients.length - 3} more`;
  const kind = draft.mode === "REPLY" ? "Reply" : draft.mode === "BROADCAST" ? `Broadcast (${recipients.length} individual emails)` : "New email";
  const header = `📝 *Draft – ${kind}*\n*From:* ${draft.account.address}\n*To:* ${to}\n*Subject:* ${draft.subject}\n\n`;
  const full = header + draft.body;
  const buttons = [
    { id: `send:${draft.id}`, title: "✅ Send" },
    { id: `edit:${draft.id}`, title: "✏️ Edit" },
    { id: `cancel:${draft.id}`, title: "❌ Cancel" },
  ];
  let waId: string;
  if (full.length <= 1000) {
    waId = await sendButtons(full, buttons, { footer: "Nothing is sent until you tap Send" });
  } else {
    await sendText(full);
    waId = await sendButtons(`Approve the draft above? (“${draft.subject}”)`, buttons, { footer: "Nothing is sent until you tap Send" });
  }
  await prisma.draft.update({ where: { id: draft.id }, data: { waMessageId: waId } });
  return waId;
}
