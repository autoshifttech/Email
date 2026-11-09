/**
 * MailBridge worker: keeps one IMAP IDLE connection per active account,
 * stores new mail, summarizes it with AI and sends it to WhatsApp.
 * Run with:  npm run worker
 */
import "./env";
import type { EmailAccount } from "@prisma/client";
import type { ImapFlow } from "imapflow";
import { prisma, logActivity } from "../src/lib/db";
import { accountToConfig, createImapClient, humanMailError, parseRaw } from "../src/lib/mail";
import { processNewEmail } from "../src/lib/ingest";

const BACKFILL = Number(process.env.BACKFILL_COUNT ?? 20); // emails imported (not notified) on first connect
const RECONCILE_MS = 15_000;

type Watcher = { account: EmailAccount; client: ImapFlow | null; stopped: boolean; retry: number; timer?: NodeJS.Timeout; busy: Promise<void> };
const watchers = new Map<string, Watcher>();

const log = (a: Pick<EmailAccount, "label">, ...m: unknown[]) => console.log(`[${new Date().toISOString()}] [${a.label}]`, ...m);
const debug = (a: Pick<EmailAccount, "label">, ...m: unknown[]) => process.env.WORKER_DEBUG && log(a, ...m);

async function setStatus(id: string, status: string, lastError: string | null = null) {
  await prisma.emailAccount.update({ where: { id }, data: { status, lastError, ...(status === "connected" ? { lastSyncAt: new Date() } : {}) } }).catch(() => {});
}

async function storeMessage(account: EmailAccount, uid: number, source: Buffer, date: Date | undefined, seen: boolean) {
  const p = await parseRaw(source, date);
  if (p.messageId) {
    const dup = await prisma.email.findFirst({ where: { accountId: account.id, messageId: p.messageId, direction: "IN" } });
    if (dup) return null;
  }
  return prisma.email.create({
    data: { accountId: account.id, direction: "IN", uid, mailbox: "INBOX", ...p, isRead: seen },
  });
}

/** Fetch every message with UID greater than lastUid. */
async function syncNew(w: Watcher, notify: boolean) {
  const client = w.client;
  if (!client) return;
  const acc = await prisma.emailAccount.findUnique({ where: { id: w.account.id } });
  if (!acc) return;
  const lock = await client.getMailboxLock("INBOX");
  const created: string[] = [];
  let maxUid = acc.lastUid;
  debug(acc, `fetching UID ${acc.lastUid + 1}:*`);
  try {
    for await (const msg of client.fetch(`${acc.lastUid + 1}:*`, { uid: true, source: true, internalDate: true, flags: true }, { uid: true })) {
      if (msg.uid <= acc.lastUid || !msg.source) continue; // "N:*" always returns the last message
      const internal = msg.internalDate ? new Date(msg.internalDate) : undefined;
      const e = await storeMessage(acc, msg.uid, msg.source, internal, msg.flags?.has("\\Seen") ?? false);
      if (e) created.push(e.id);
      maxUid = Math.max(maxUid, msg.uid);
    }
  } finally {
    lock.release();
  }
  if (maxUid !== acc.lastUid) await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: maxUid, lastSyncAt: new Date() } });
  if (created.length) log(acc, `stored ${created.length} new email(s)`);
  if (notify) for (const id of created) await processNewEmail(id);
}

/** First connection: import the latest few messages for the dashboard without notifying. */
async function initialSync(w: Watcher) {
  const client = w.client!;
  const acc = (await prisma.emailAccount.findUnique({ where: { id: w.account.id } }))!;
  const mailbox = client.mailbox;
  if (!mailbox) return;
  const validity = String(mailbox.uidValidity);
  if (acc.uidValidity && acc.uidValidity !== validity) {
    log(acc, "UIDVALIDITY changed – resetting sync position");
    await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: 0 } });
    acc.lastUid = 0;
  }
  if (acc.lastUid === 0) {
    const uidNext = Number(mailbox.uidNext ?? 1);
    const total = mailbox.exists ?? 0;
    if (total > 0 && BACKFILL > 0) {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const from = Math.max(1, total - BACKFILL + 1);
        for await (const msg of client.fetch(`${from}:*`, { uid: true, source: true, internalDate: true, flags: true })) {
          if (!msg.source) continue;
          await storeMessage(acc, msg.uid, msg.source, msg.internalDate ? new Date(msg.internalDate) : undefined, msg.flags?.has("\\Seen") ?? false);
        }
      } finally {
        lock.release();
      }
    }
    await prisma.emailAccount.update({ where: { id: acc.id }, data: { lastUid: uidNext - 1, uidValidity: validity } });
    log(acc, `initial sync done (imported up to ${BACKFILL} recent emails)`);
  } else {
    if (!acc.uidValidity) await prisma.emailAccount.update({ where: { id: acc.id }, data: { uidValidity: validity } });
    // Catch up on anything that arrived while we were offline – these DO notify.
    await syncNew(w, true);
  }
}

function queue(w: Watcher, fn: () => Promise<void>) {
  w.busy = w.busy
    .then(fn)
    .catch((e) => log(w.account, "sync error:", humanMailError(e)))
    .finally(() => {
      // Enter IDLE right away (ImapFlow otherwise waits ~15s of inactivity before idling).
      if (w.client?.usable && !w.client.idling) w.client.idle().catch(() => {});
    });
  return w.busy;
}

async function connect(w: Watcher) {
  if (w.stopped) return;
  const acc = w.account;
  let client: ImapFlow;
  try {
    client = createImapClient(accountToConfig(acc));
  } catch (e) {
    await setStatus(acc.id, "error", humanMailError(e));
    return;
  }
  w.client = client;
  client.on("error", (e) => log(acc, "imap error:", humanMailError(e)));
  client.on("exists", (d) => {
    debug(acc, "exists event", d);
    queue(w, () => syncNew(w, true));
  });
  client.on("close", () => {
    w.client = null;
    if (w.stopped) return;
    const delay = Math.min(5 * 60_000, 5_000 * 2 ** w.retry++);
    log(acc, `connection closed – reconnecting in ${Math.round(delay / 1000)}s`);
    w.timer = setTimeout(() => connect(w), delay);
  });
  try {
    await client.connect();
    await client.mailboxOpen("INBOX");
    w.retry = 0;
    await setStatus(acc.id, "connected");
    log(acc, "connected, watching INBOX (IDLE)");
    await queue(w, () => initialSync(w));
  } catch (e) {
    const msg = humanMailError(e);
    log(acc, "connect failed:", msg);
    await setStatus(acc.id, "error", msg);
    await logActivity("error", `${acc.label}: ${msg}`);
    try {
      client.close();
    } catch {
      /* close handler schedules the retry */
    }
  }
}

async function stop(id: string) {
  const w = watchers.get(id);
  if (!w) return;
  w.stopped = true;
  if (w.timer) clearTimeout(w.timer);
  watchers.delete(id);
  await w.client?.logout().catch(() => w.client?.close());
}

/** Start/stop/restart watchers when accounts are added, edited, disabled or deleted in the dashboard. */
async function reconcile() {
  const accounts = await prisma.emailAccount.findMany();
  const active = new Map(accounts.filter((a) => a.isActive).map((a) => [a.id, a]));
  for (const id of [...watchers.keys()]) {
    const w = watchers.get(id)!;
    const a = active.get(id);
    const changed = a && (a.updatedAt.getTime() !== w.account.updatedAt.getTime()) &&
      ["imapHost", "imapPort", "imapSecure", "username", "encPassword"].some((k) => (a as never)[k] !== (w.account as never)[k]);
    if (!a || changed) {
      log(w.account, a ? "settings changed – restarting" : "removed/disabled – stopping");
      await stop(id);
    } else if (a) {
      w.account = a;
    }
  }
  for (const a of accounts.filter((x) => !x.isActive && x.status !== "disabled")) await setStatus(a.id, "disabled");
  for (const [id, a] of active) {
    if (watchers.has(id)) continue;
    const w: Watcher = { account: a, client: null, stopped: false, retry: 0, busy: Promise.resolve() };
    watchers.set(id, w);
    connect(w);
  }
}

async function main() {
  console.log("📬 MailBridge worker starting…");
  await reconcile();
  setInterval(() => reconcile().catch((e) => console.error("reconcile failed", e)), RECONCILE_MS);
  // Safety net: poll every 3 minutes in case a server silently drops IDLE.
  setInterval(() => {
    for (const w of watchers.values()) if (w.client?.usable) queue(w, () => syncNew(w, true));
  }, 3 * 60_000);
}

const shutdown = async () => {
  console.log("Shutting down…");
  await Promise.all([...watchers.keys()].map(stop));
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
