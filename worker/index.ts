/**
 * MailBridge worker: keeps one IMAP IDLE connection per active account,
 * stores new mail, summarizes it with AI and sends it to WhatsApp.
 * Run with:  npm run worker
 */
import "./env";
import type { EmailAccount } from "@prisma/client";
import type { ImapFlow } from "imapflow";
import { prisma, logActivity } from "../src/lib/db";
import { accountToConfig, createImapClient, humanMailError } from "../src/lib/mail";
import { processNewEmail } from "../src/lib/ingest";
import { fetchNew, prepareSync, setAccountStatus as setStatus, BACKFILL } from "../src/lib/sync";

const RECONCILE_MS = 15_000;

type Watcher = { account: EmailAccount; client: ImapFlow | null; stopped: boolean; retry: number; timer?: NodeJS.Timeout; busy: Promise<void> };
const watchers = new Map<string, Watcher>();

const log = (a: Pick<EmailAccount, "label">, ...m: unknown[]) => console.log(`[${new Date().toISOString()}] [${a.label}]`, ...m);
const debug = (a: Pick<EmailAccount, "label">, ...m: unknown[]) => process.env.WORKER_DEBUG && log(a, ...m);

/** Fetch every message with UID greater than lastUid, then summarize + notify. */
async function syncNew(w: Watcher, notify: boolean) {
  if (!w.client) return;
  debug(w.account, "syncing new mail");
  const created = await fetchNew(w.client, w.account.id);
  if (created.length) log(w.account, `stored ${created.length} new email(s)`);
  if (notify) for (const id of created) await processNewEmail(id);
}

/** First connection: import the latest few messages silently, or catch up on missed mail. */
async function initialSync(w: Watcher) {
  const first = await prepareSync(w.client!, w.account.id);
  if (first) log(w.account, `initial sync done (imported up to ${BACKFILL()} recent emails)`);
  else await syncNew(w, true); // mail that arrived while offline DOES notify
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
