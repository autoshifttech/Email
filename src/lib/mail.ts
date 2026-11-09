import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer";
import { simpleParser, type AddressObject, type ParsedMail } from "mailparser";
import type { EmailAccount } from "@prisma/client";
import { decrypt } from "./crypto";

export type MailServerConfig = {
  address: string;
  displayName?: string;
  username: string;
  password: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
};

export function accountToConfig(a: EmailAccount): MailServerConfig {
  return {
    address: a.address,
    displayName: a.displayName,
    username: a.username,
    password: decrypt(a.encPassword),
    imapHost: a.imapHost,
    imapPort: a.imapPort,
    imapSecure: a.imapSecure,
    smtpHost: a.smtpHost,
    smtpPort: a.smtpPort,
    smtpSecure: a.smtpSecure,
  };
}

export function createImapClient(c: MailServerConfig) {
  return new ImapFlow({
    host: c.imapHost,
    port: c.imapPort,
    secure: c.imapSecure,
    auth: { user: c.username, pass: c.password },
    logger: false,
    maxIdleTime: 5 * 60 * 1000, // re-issue IDLE every 5 min (some servers drop long IDLEs)
    connectionTimeout: 20_000,
    greetingTimeout: 15_000,
    tls: { rejectUnauthorized: process.env.MAIL_TLS_INSECURE !== "true" },
  });
}

export function createTransport(c: MailServerConfig) {
  return nodemailer.createTransport({
    host: c.smtpHost,
    port: c.smtpPort,
    secure: c.smtpSecure,
    auth: { user: c.username, pass: c.password },
    connectionTimeout: 20_000,
    tls: { rejectUnauthorized: process.env.MAIL_TLS_INSECURE !== "true" },
  });
}

export async function testConnection(c: MailServerConfig) {
  const result = { imap: { ok: false, message: "" }, smtp: { ok: false, message: "" } };
  const imap = createImapClient(c);
  imap.on("error", () => {});
  try {
    await imap.connect();
    const status = await imap.status("INBOX", { messages: true, unseen: true });
    result.imap = { ok: true, message: `Connected. INBOX has ${status.messages ?? 0} messages (${status.unseen ?? 0} unread).` };
  } catch (e) {
    result.imap = { ok: false, message: humanMailError(e) };
  } finally {
    await imap.logout().catch(() => {});
  }
  try {
    await createTransport(c).verify();
    result.smtp = { ok: true, message: "SMTP login OK." };
  } catch (e) {
    result.smtp = { ok: false, message: humanMailError(e) };
  }
  return result;
}

export function humanMailError(e: unknown): string {
  const err = e as { message?: string; responseText?: string; response?: string; code?: string; authenticationFailed?: boolean };
  if (err?.authenticationFailed || /auth|credential|password|login/i.test(err?.responseText ?? err?.response ?? "")) {
    return "Authentication failed: check the username and (app) password.";
  }
  if (err?.code === "ENOTFOUND") return "Server not found: check the host name.";
  if (err?.code === "ECONNREFUSED") return "Connection refused: check the port and SSL setting.";
  if (err?.code === "ETIMEDOUT" || err?.code === "ETIMEOUT") return "Connection timed out: check host, port and SSL setting.";
  return err?.responseText || err?.response || err?.message || String(e);
}

function addrList(a: AddressObject | AddressObject[] | undefined): string {
  if (!a) return "";
  const arr = Array.isArray(a) ? a : [a];
  return arr.map((x) => x.text).join(", ");
}

export type ParsedEmail = {
  messageId: string | null;
  inReplyTo: string | null;
  references: string;
  fromName: string;
  fromAddress: string;
  to: string;
  cc: string;
  subject: string;
  text: string;
  html: string;
  snippet: string;
  receivedAt: Date;
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseRaw(source: Buffer | string, fallbackDate?: Date): Promise<ParsedEmail> {
  const m: ParsedMail = await simpleParser(source);
  const from = m.from?.value?.[0];
  const html = typeof m.html === "string" ? m.html : "";
  const text = (m.text && m.text.trim()) || (html ? htmlToText(html) : "");
  const refs = Array.isArray(m.references) ? m.references.join(" ") : m.references ?? "";
  return {
    messageId: m.messageId ?? null,
    inReplyTo: m.inReplyTo ?? null,
    references: refs,
    fromName: from?.name ?? "",
    fromAddress: (from?.address ?? "").toLowerCase(),
    to: addrList(m.to),
    cc: addrList(m.cc),
    subject: m.subject ?? "(no subject)",
    text: text.slice(0, 200_000),
    html: html.slice(0, 500_000),
    snippet: text.replace(/\s+/g, " ").slice(0, 200),
    receivedAt: m.date ?? fallbackDate ?? new Date(),
  };
}

export type OutgoingMail = {
  to: string[];
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string | null;
};

/** Send via SMTP and (optionally) save a copy in the IMAP Sent folder. Returns the Message-ID. */
export async function sendMail(account: EmailAccount, mail: OutgoingMail): Promise<string> {
  const c = accountToConfig(account);
  const from = c.displayName ? { name: c.displayName, address: c.address } : c.address;
  const options = {
    from,
    to: mail.to,
    subject: mail.subject,
    text: mail.text,
    ...(mail.inReplyTo ? { inReplyTo: mail.inReplyTo } : {}),
    ...(mail.inReplyTo || mail.references
      ? { references: [mail.references, mail.inReplyTo].filter(Boolean).join(" ").trim() }
      : {}),
  };
  const info = await createTransport(c).sendMail(options);
  if (account.appendSent) {
    appendToSent(c, options).catch(() => {}); // best effort
  }
  return info.messageId;
}

async function appendToSent(c: MailServerConfig, options: Record<string, unknown>) {
  const raw: Buffer = await new MailComposer(options).compile().build();
  const imap = createImapClient(c);
  imap.on("error", () => {});
  try {
    await imap.connect();
    const boxes = await imap.list();
    const sent = boxes.find((b) => b.specialUse === "\\Sent") ?? boxes.find((b) => /^(sent|sent items|sent mail)$/i.test(b.name));
    if (sent) await imap.append(sent.path, raw, ["\\Seen"]);
  } finally {
    await imap.logout().catch(() => {});
  }
}

/** Delete or flag a message on the mail server (used by dashboard actions). */
export async function serverAction(account: EmailAccount, mailbox: string, uid: number, action: "delete" | "seen" | "unseen") {
  const imap = createImapClient(accountToConfig(account));
  imap.on("error", () => {});
  try {
    await imap.connect();
    const lock = await imap.getMailboxLock(mailbox);
    try {
      if (action === "delete") await imap.messageDelete(String(uid), { uid: true });
      if (action === "seen") await imap.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
      if (action === "unseen") await imap.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await imap.logout().catch(() => {});
  }
}
