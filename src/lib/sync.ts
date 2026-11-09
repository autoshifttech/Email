/**
 * Mailbox sync shared by the long-running worker (IMAP IDLE) and the
 * serverless sync endpoint (/api/cron/sync, for Vercel and similar hosts).
 */
import type { EmailAccount } from "@prisma/client";
import type { ImapFlow } from "imapflow";
import { prisma, logActivity } from "./db";
import { accountToConfig, createImapClient, humanMailError, parseRaw } from "./mail";
import { processNewEmail } from "./ingest";

export const BACKFILL = () => Number(process.env.BACKFILL_COUNT ?? 20);

export async function setAccountStatus(id: string, status: string, lastError: string | null = null) {
  await prisma.emailAccount
    .update({ where: { id }, data: { status, lastError, ...(status === "connected" ? { lastSyncAt: new Date() } : {}) } })
    .catch(() => {});
}

async function storeMessage(account: EmailAccount, uid: number, source: Buffer, date: Date | undefined, seen: boolean) {
  const p = await parseRaw(source, date);
  if (p.messageId) {
    const dup = await prisma.email.findFirst({ where: { accountId: account.id, messageId: p.messageId, direction: "IN" } });
    if (dup) return null;
  }
  return prisma.email.create({ data: { accountId: account.id, direction: "IN", uid, mailbox: "INBOX", ...p, isRead: seen } });
}

/**
 * Fetch messages newer than lastUid and store them. Returns ids of new emails
 * (not yet summarized/notified). `limit` caps how many are fetched in one go.
 */
export async function fetchNew(client: ImapFlow, accountId: string, limit = Infinity): Promise<string[]> {
  const acc = await prisma.emailAccount.findUnique({ where: { id: accountId } });
  if (!acc) return [];
  const lock = await client.getMailboxLock("INBOX");
  const created: string[] = [];
  let maxUid = acc.lastUid;
  try {
    for await (const msg of client.fetch(`${acc.lastUid + 1}:*`, { uid: true, source: true, internalDate: true, flags: true }, { uid: true })) {
      if (msg.uid <= acc.lastUid || !msg.source) continue; // "N:*" always returns the newest message
      if (created.length >= limit) break;
      const e = await storeMessage(acc, msg.uid, msg.source, msg.internalDate ? new Date(msg.internalDate) : undefined, msg.flags?.has("\\Seen") ?? false);
      if (e) created.push(e.id);
      maxUid = Math.max(maxUid, msg.uid);
    }
  } finally {
    lock.release();
  }
  if (maxUid !== acc.lastUid) await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: maxUid, lastSyncAt: new Date() } });
  return created;
}

/**
 * Called right after connecting + opening INBOX. On the very first sync it
 * imports the latest few emails silently (no WhatsApp). Returns true if this
 * was the first sync (nothing to notify).
 */
export async function prepareSync(client: ImapFlow, accountId: string): Promise<boolean> {
  const acc = await prisma.emailAccount.findUniqueOrThrow({ where: { id: accountId } });
  const mailbox = client.mailbox;
  if (!mailbox) return false;
  const validity = String(mailbox.uidValidity);
  let lastUid = acc.lastUid;
  if (acc.uidValidity && acc.uidValidity !== validity) {
    await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: 0 } });
    lastUid = 0;
  }
  if (lastUid === 0) {
    const uidNext = Number(mailbox.uidNext ?? 1);
    const total = mailbox.exists ?? 0;
    const n = BACKFILL();
    if (total > 0 && n > 0) {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const from = Math.max(1, total - n + 1);
        for await (const msg of client.fetch(`${from}:*`, { uid: true, source: true, internalDate: true, flags: true })) {
          if (!msg.source) continue;
          await storeMessage(acc, msg.uid, msg.source, msg.internalDate ? new Date(msg.internalDate) : undefined, msg.flags?.has("\\Seen") ?? false);
        }
      } finally {
        lock.release();
      }
    }
    await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: uidNext - 1, uidValidity: validity, lastSyncAt: new Date() } });
    return true;
  }
  if (!acc.uidValidity) await prisma.emailAccount.update({ where: { id: acc.id }, data: { uidValidity: validity } });
  return false;
}

export type SyncResult = { accountId: string; label: string; ok: boolean; newEmails: number; initial: boolean; error?: string; more?: boolean };

/** Connect, sync once, summarize + notify new mail, disconnect. Used on serverless hosts. */
export async function syncAccountOnce(account: EmailAccount, opts: { maxEmails?: number } = {}): Promise<SyncResult> {
  const max = opts.maxEmails ?? 10;
  const res: SyncResult = { accountId: account.id, label: account.label, ok: false, newEmails: 0, initial: false };
  let client: ImapFlow | null = null;
  try {
    client = createImapClient(accountToConfig(account));
    client.on("error", () => {});
    await client.connect();
    await client.mailboxOpen("INBOX");
    res.initial = await prepareSync(client, account.id);
    if (!res.initial) {
      const ids = await fetchNew(client, account.id, max);
      res.newEmails = ids.length;
      res.more = ids.length >= max;
      await client.logout().catch(() => {});
      client = null;
      for (const id of ids) await processNewEmail(id);
    }
    await setAccountStatus(account.id, "connected");
    res.ok = true;
  } catch (e) {
    res.error = humanMailError(e);
    await setAccountStatus(account.id, "error", res.error);
    await logActivity("error", `${account.label}: ${res.error}`);
  } finally {
    if (client) await client.logout().catch(() => client?.close());
  }
  return res;
}

/** Sync every active account (in parallel, bounded by the platform time limit). */
export async function syncAllOnce(opts: { maxEmails?: number } = {}) {
  const accounts = await prisma.emailAccount.findMany({ where: { isActive: true } });
  return Promise.all(accounts.map((a) => syncAccountOnce(a, opts)));
}
