import type { EmailAccount } from "@prisma/client";
import { prisma, logActivity } from "./db";
import { draftNew, draftReply, reviseDraft, AiNotConfiguredError } from "./ai";
import { notifyEmail, sendDraftPreview } from "./notify";
import { sendDraft, draftRecipients } from "./send";
import { resolveTarget } from "./recipients";
import { sendText, type WaIncoming } from "./whatsapp";
import { HELP_TEXT, parseButton, parseCommand } from "./command-parser";
import { errMsg } from "./auth";

type State = "IDLE" | "AWAIT_AI_PROMPT" | "AWAIT_MANUAL_TEXT" | "AWAIT_EDIT";

async function setSession(phone: string, state: State, ids: { emailId?: string | null; draftId?: string | null } = {}) {
  const data = { state, emailId: ids.emailId ?? null, draftId: ids.draftId ?? null };
  await prisma.waSession.upsert({ where: { phone }, create: { phone, ...data }, update: data });
}

async function getSession(phone: string) {
  const s = await prisma.waSession.findUnique({ where: { phone } });
  // Sessions expire after 30 minutes of inactivity.
  if (s && Date.now() - s.updatedAt.getTime() > 30 * 60 * 1000) return null;
  return s;
}

async function defaultAccount(label?: string): Promise<EmailAccount | null> {
  const accounts = await prisma.emailAccount.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  if (label) {
    const l = label.toLowerCase();
    return accounts.find((a) => a.label.toLowerCase() === l || a.address.toLowerCase() === l || a.address.toLowerCase().startsWith(l + "@")) ?? null;
  }
  return accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
}

async function createReplyDraft(emailId: string, instructions: string, author: "AI" | "MANUAL") {
  const email = await prisma.email.findUniqueOrThrow({ where: { id: emailId } });
  const content =
    author === "AI"
      ? await draftReply(email, /^auto$/i.test(instructions.trim()) ? "" : instructions)
      : { subject: email.subject.toLowerCase().startsWith("re:") ? email.subject : `Re: ${email.subject}`, body: instructions };
  const replyTo = email.fromAddress;
  return prisma.draft.create({
    data: {
      accountId: email.accountId,
      replyToEmailId: email.id,
      mode: "REPLY",
      recipients: JSON.stringify([replyTo]),
      subject: content.subject,
      body: content.body,
      prompt: author === "AI" ? instructions : null,
      author,
      origin: "WHATSAPP",
    },
    include: { account: true },
  });
}

async function previewAndWait(phone: string, draft: Parameters<typeof sendDraftPreview>[0]) {
  await sendDraftPreview(draft);
  await setSession(phone, "IDLE", { draftId: draft.id });
}

async function handleButton(phone: string, action: string, id: string) {
  switch (action) {
    case "ai": {
      const email = await prisma.email.findUnique({ where: { id } });
      if (!email) return sendText("That email no longer exists.");
      await setSession(phone, "AWAIT_AI_PROMPT", { emailId: id });
      return sendText(
        `🤖 What should the reply to *${email.fromName || email.fromAddress}* say?\n\n` +
          `e.g. _"thank them, confirm the meeting on Monday 11am"_\nSend *auto* to let the AI decide, or *cancel*.`,
      );
    }
    case "manual": {
      if (!(await prisma.email.findUnique({ where: { id } }))) return sendText("That email no longer exists.");
      await setSession(phone, "AWAIT_MANUAL_TEXT", { emailId: id });
      return sendText("✍️ Type your reply exactly as it should be sent (or *cancel*).");
    }
    case "ignore": {
      await prisma.email.updateMany({ where: { id }, data: { isRead: true } });
      await setSession(phone, "IDLE");
      return sendText("👍 Marked as read.");
    }
    case "send": {
      const draft = await prisma.draft.findUnique({ where: { id } });
      if (!draft) return sendText("Draft not found.");
      if (draft.status === "SENT") return sendText("✅ This draft was already sent.");
      if (draft.status === "REJECTED") return sendText("This draft was cancelled.");
      const total = draftRecipients(draft).length;
      if (draft.mode === "BROADCAST") await sendText(`📤 Sending to ${total} recipients…`);
      try {
        const r = await sendDraft(id);
        await setSession(phone, "IDLE");
        if (r.ok) {
          return sendText(
            `✅ Sent “${draft.subject}” to ${r.sent} recipient${r.sent === 1 ? "" : "s"}.` +
              (r.failed ? `\n⚠️ ${r.failed} failed:\n${r.errors.slice(0, 5).join("\n")}` : ""),
          );
        }
        return sendText(`❌ Sending failed:\n${r.errors.slice(0, 5).join("\n")}\n\nTap ✅ Send again to retry.`);
      } catch (e) {
        return sendText(`❌ ${errMsg(e)}`);
      }
    }
    case "edit": {
      const draft = await prisma.draft.findUnique({ where: { id } });
      if (!draft || draft.status !== "PENDING_APPROVAL") return sendText("This draft can no longer be edited.");
      await setSession(phone, "AWAIT_EDIT", { draftId: id });
      return sendText(
        "✏️ How should I change it?\n\n• Describe the change for the AI, e.g. _\"make it shorter and more formal\"_\n" +
          "• Or start with *text:* to replace the whole body with your own words\n• Or *subject: <new subject>*",
      );
    }
    case "cancel": {
      await prisma.draft.updateMany({ where: { id, status: "PENDING_APPROVAL" }, data: { status: "REJECTED" } });
      await setSession(phone, "IDLE");
      return sendText("❌ Draft cancelled. Nothing was sent.");
    }
  }
}

async function applyEdit(phone: string, draftId: string, text: string) {
  const draft = await prisma.draft.findUnique({ where: { id: draftId } });
  if (!draft || draft.status !== "PENDING_APPROVAL") {
    await setSession(phone, "IDLE");
    return sendText("This draft can no longer be edited.");
  }
  let data: { subject?: string; body?: string };
  const t = /^text\s*:\s*([\s\S]+)$/i.exec(text);
  const s = /^subject\s*:\s*([\s\S]+)$/i.exec(text);
  if (t) data = { body: t[1].trim() };
  else if (s) data = { subject: s[1].trim() };
  else {
    await sendText("⏳ Revising…");
    data = await reviseDraft({ subject: draft.subject, body: draft.body }, text);
  }
  const updated = await prisma.draft.update({ where: { id: draftId }, data, include: { account: true } });
  await previewAndWait(phone, updated);
}

/** Main entry point for a message from the owner. */
export async function handleIncoming(msg: WaIncoming) {
  const phone = msg.from;
  try {
    // 1) Button taps
    const btnId = msg.interactive?.button_reply?.id ?? msg.interactive?.list_reply?.id ?? msg.button?.payload;
    const btn = parseButton(btnId);
    if (btn) return await handleButton(phone, btn.action, btn.id);

    const text = msg.text?.body?.trim() ?? msg.button?.text ?? "";
    if (!text) return await sendText("I can only read text messages for now. Send *help* for commands.");

    const cmd = parseCommand(text);
    const session = await getSession(phone);
    const ctxId = msg.context?.id;

    // 2) Explicit commands
    switch (cmd.type) {
      case "help":
        return await sendText(HELP_TEXT);
      case "cancel":
        await setSession(phone, "IDLE");
        return await sendText("OK, cancelled.");
      case "accounts": {
        const accs = await prisma.emailAccount.findMany({ orderBy: { createdAt: "asc" } });
        if (!accs.length) return await sendText("No email accounts yet. Add one in the dashboard.");
        return await sendText(
          "*Email accounts*\n" +
            accs
              .map((a) => `${a.status === "connected" ? "🟢" : a.status === "error" ? "🔴" : "⚪"} *${a.label}* – ${a.address}${a.isDefault ? " (default)" : ""}${a.isActive ? "" : " [disabled]"}`)
              .join("\n"),
        );
      }
      case "inbox": {
        const emails = await prisma.email.findMany({
          where: { direction: "IN", isRead: false, isArchived: false },
          orderBy: { receivedAt: "desc" },
          take: 5,
        });
        if (!emails.length) return await sendText("📭 No unread emails. You're all caught up!");
        await sendText(`📬 ${emails.length} latest unread email(s):`);
        for (const e of emails.reverse()) await notifyEmail(e.id, { force: true });
        return;
      }
      case "drafts": {
        const drafts = await prisma.draft.findMany({ where: { status: "PENDING_APPROVAL" }, include: { account: true }, orderBy: { createdAt: "desc" }, take: 3 });
        if (!drafts.length) return await sendText("No drafts waiting for approval.");
        for (const d of drafts) await sendDraftPreview(d);
        return;
      }
      case "new":
      case "send": {
        const account = await defaultAccount(cmd.from);
        if (!account) return await sendText(cmd.from ? `No active account matches "${cmd.from}". Send *accounts* to see them.` : "No active email account. Add one in the dashboard first.");
        const r = await resolveTarget(cmd.target);
        if (!r.emails.length) {
          return await sendText(`I couldn't find any recipients for "${cmd.target}".${r.unknown.length ? ` Unknown: ${r.unknown.join(", ")}` : ""}\nUse email addresses, a contact name, a group name or *all*.`);
        }
        const broadcast = r.emails.length > 1 && (!!r.groupId || /^(all|everyone)/i.test(cmd.target.trim()));
        if (cmd.type === "new") await sendText(`⏳ Writing the email to ${r.label}…`);
        const content =
          cmd.type === "new"
            ? await draftNew(cmd.prompt, { subject: cmd.subject, broadcast, recipientHint: broadcast ? "multiple people, sent individually" : r.label })
            : { subject: cmd.subject, body: cmd.body };
        const draft = await prisma.draft.create({
          data: {
            accountId: account.id,
            mode: broadcast ? "BROADCAST" : "NEW",
            recipients: JSON.stringify(r.emails),
            groupId: r.groupId ?? null,
            subject: content.subject,
            body: content.body,
            prompt: cmd.type === "new" ? cmd.prompt : null,
            author: cmd.type === "new" ? "AI" : "MANUAL",
            origin: "WHATSAPP",
          },
          include: { account: true },
        });
        if (r.unknown.length) await sendText(`⚠️ Skipped unknown recipients: ${r.unknown.join(", ")}`);
        return await previewAndWait(phone, draft);
      }
    }

    // 3) Swipe-reply (context) to an email card or a draft preview
    if (ctxId) {
      const email = await prisma.email.findFirst({ where: { waMessageId: ctxId } });
      if (email) {
        if (cmd.type === "reply") {
          const d = await createReplyDraft(email.id, cmd.text, "MANUAL");
          return await previewAndWait(phone, d);
        }
        await sendText("⏳ Drafting reply…");
        const d = await createReplyDraft(email.id, text, "AI");
        return await previewAndWait(phone, d);
      }
      const draft = await prisma.draft.findFirst({ where: { waMessageId: ctxId } });
      if (draft) return await applyEdit(phone, draft.id, text);
    }

    // 4) Continuing a multi-step flow
    if (session?.state === "AWAIT_AI_PROMPT" && session.emailId) {
      await sendText("⏳ Drafting reply…");
      const d = await createReplyDraft(session.emailId, cmd.type === "reply" ? cmd.text : text, cmd.type === "reply" ? "MANUAL" : "AI");
      return await previewAndWait(phone, d);
    }
    if (session?.state === "AWAIT_MANUAL_TEXT" && session.emailId) {
      const d = await createReplyDraft(session.emailId, cmd.type === "reply" ? cmd.text : text, "MANUAL");
      return await previewAndWait(phone, d);
    }
    if (session?.state === "AWAIT_EDIT" && session.draftId) {
      return await applyEdit(phone, session.draftId, text);
    }
    if (cmd.type === "reply") {
      return await sendText("Swipe-reply to an email notification with *reply: <text>* so I know which email you mean.");
    }

    return await sendText(`I didn't understand that. 🤔\nSend *help* to see what I can do.`);
  } catch (e) {
    const m = e instanceof AiNotConfiguredError ? e.message : `Something went wrong: ${errMsg(e)}`;
    await logActivity("error", `WhatsApp command failed: ${errMsg(e)}`);
    await sendText(`⚠️ ${m}`).catch(() => {});
  }
}
