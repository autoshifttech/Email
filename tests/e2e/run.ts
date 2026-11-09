/**
 * End-to-end test: real IMAP (pymap) + real SMTP + real Next.js app + real worker,
 * with mocked AI and WhatsApp APIs.  Run:  npx tsx tests/e2e/run.ts
 * Requires PYMAP env var pointing to a pymap binary (pip install pymap), psql, and a
 * throwaway Postgres database (E2E_DATABASE_URL, default postgres://…/mailbridge_e2e) that is wiped.
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import { createHmac } from "node:crypto";
import nodemailer from "nodemailer";
import { aiCalls, smtpOutbox, startAi, startSmtp, startWhatsApp, waOutbox } from "./mocks";

const P = { imap: 11143, smtp: 12525, ai: 14010, wa: 14020, app: 13100 };
const APP = `http://127.0.0.1:${P.app}`;
const MAILBOX = "test@local.test";
const OWNER = "919999999999";
const APP_SECRET = "test-app-secret";
const env = {
  ...process.env,
  DATABASE_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mailbridge_e2e",
  DIRECT_URL: process.env.E2E_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/mailbridge_e2e",
  AUTH_SECRET: "e2e-auth-secret-0123456789",
  ENCRYPTION_KEY: "e2e-encryption-key-0123456789",
  APP_URL: APP,
  WA_GRAPH_URL: `http://127.0.0.1:${P.wa}`,
  BROADCAST_DELAY_MS: "50",
  BACKFILL_COUNT: "5",
  WORKER_DEBUG: "1",
  PORT: String(P.app),
  AI_API_KEY: "", WA_ACCESS_TOKEN: "", OWNER_WHATSAPP_NUMBER: "",
};

const procs: ChildProcess[] = [];
let cookie = "";
let passed = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function ok(cond: unknown, msg: string) {
  if (!cond) throw new Error(`❌ FAILED: ${msg}`);
  passed++;
  console.log(`  ✅ ${msg}`);
}
async function waitFor<T>(fn: () => Promise<T | undefined | null | false> | T | undefined | null | false, what: string, ms = 30000): Promise<T> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v as T;
    await sleep(400);
  }
  throw new Error(`Timed out waiting for: ${what}`);
}
async function call<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(APP + path, {
    method: opts.method ?? (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", cookie },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
  const set = res.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${opts.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data as T;
}
let inSeq = 0;
async function webhook(message: Record<string, unknown>, sign = true) {
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "1", changes: [{ field: "messages", value: { messaging_product: "whatsapp", messages: [{ id: `wamid.in.${++inSeq}`, from: OWNER, timestamp: "1", ...message }] } }] }] });
  const sig = "sha256=" + createHmac("sha256", APP_SECRET).update(payload).digest("hex");
  return fetch(`${APP}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", ...(sign ? { "x-hub-signature-256": sig } : {}) }, body: payload });
}
const lastWa = () => waOutbox[waOutbox.length - 1] as any;
const waText = (m: any) => m?.text?.body ?? m?.interactive?.body?.text ?? "";

function start(cmd: string, args: string[], name: string) {
  const p = spawn(cmd, args, { env, cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], detached: true });
  const log = (d: Buffer) => process.env.E2E_VERBOSE && process.stdout.write(`[${name}] ${d}`);
  p.stdout!.on("data", log);
  p.stderr!.on("data", (d) => { if (process.env.E2E_VERBOSE || /error/i.test(String(d))) process.stdout.write(`[${name}] ${d}`); });
  procs.push(p);
  return p;
}

async function main() {
  if (!process.env.PYMAP) throw new Error("Set PYMAP=/path/to/pymap");
  console.log("▶ preparing database");
  // Fresh schema in the dedicated e2e database (never point this at real data).
  execSync(`psql "${env.DATABASE_URL}" -q -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"`, { stdio: "ignore" });
  execSync("npx prisma migrate deploy", { env, stdio: "ignore" });

  console.log("▶ starting IMAP (pymap), SMTP, AI mock, WhatsApp mock");
  start(process.env.PYMAP, ["--host", "127.0.0.1", "--port", String(P.imap), "--no-tls", "dict", "--demo-data", "--demo-user", MAILBOX, "--demo-password", "pass"], "imap");
  startSmtp(P.smtp, { host: "127.0.0.1", port: P.imap, user: MAILBOX, pass: "pass" });
  startAi(P.ai);
  startWhatsApp(P.wa);
  await sleep(1500);

  console.log("▶ starting web app + worker");
  start("npx", ["next", "start", "-p", String(P.app)], "web");
  const worker = start("npx", ["tsx", "worker/index.ts"], "worker");
  await waitFor(() => fetch(`${APP}/api/health`).then((r) => r.ok).catch(() => false), "web app", 60000);

  console.log("\n① Auth");
  const unauth = await fetch(`${APP}/api/accounts`);
  ok(unauth.status === 401, "API rejects unauthenticated requests");
  await call("/api/auth/setup", { body: { name: "Owner", email: "owner@example.com", password: "password123" } });
  ok(cookie.startsWith("mb_session="), "first-run setup creates owner and logs in");
  let setupAgain = 0;
  try { await call("/api/auth/setup", { body: { email: "x@y.com", password: "password123" } }); } catch { setupAgain = 1; }
  ok(setupAgain, "setup cannot be run twice");

  console.log("\n② AI key management");
  const bad = await call("/api/ai-providers/test", { body: { baseUrl: `http://127.0.0.1:${P.ai}/v1`, model: "m", apiKey: "wrong" } });
  ok(!bad.ok, "testing a wrong API key reports failure");
  const prov = await call("/api/ai-providers", { body: { name: "Mock AI", preset: "custom", baseUrl: `http://127.0.0.1:${P.ai}/v1`, model: "mock-model", apiKey: "test-ai-key" } });
  ok(prov.isActive && prov.keyHint === "test••••-key" && !("encApiKey" in prov), "provider saved, auto-activated, key hidden (hint only)");
  const t = await call(`/api/ai-providers/${prov.id}/test`, { method: "POST" });
  ok(t.ok, "saved provider test succeeds");
  const prov2 = await call("/api/ai-providers", { body: { name: "Backup", preset: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama", apiKey: "gsk_backup_key" } });
  ok(!prov2.isActive, "second provider is not active by default");
  await call(`/api/ai-providers/${prov2.id}/activate`, { method: "POST" });
  let list = await call("/api/ai-providers");
  ok(list.providers.find((p: any) => p.id === prov2.id).isActive && !list.providers.find((p: any) => p.id === prov.id).isActive, "switching active provider works");
  await call(`/api/ai-providers/${prov2.id}`, { method: "DELETE" });
  list = await call("/api/ai-providers");
  ok(list.providers.length === 1 && list.providers[0].isActive, "deleting the active provider re-activates the remaining one");
  await call(`/api/ai-providers/${prov.id}`, { method: "PATCH", body: { model: "mock-model-2" } });
  ok((await call("/api/ai-providers")).providers[0].model === "mock-model-2" && (await call(`/api/ai-providers/${prov.id}/test`, { method: "POST" })).ok, "editing provider keeps the existing key");

  console.log("\n③ WhatsApp settings");
  await call("/api/settings", { method: "PUT", body: { values: { WA_PHONE_NUMBER_ID: "123", WA_ACCESS_TOKEN: "test-wa-token", WA_APP_SECRET: APP_SECRET, WA_VERIFY_TOKEN: "verify-me", OWNER_WHATSAPP_NUMBER: "+91 99999 99999" } } });
  const st = await call("/api/settings");
  ok(st.settings.WA_ACCESS_TOKEN.isSet && st.settings.WA_ACCESS_TOKEN.value === "" && st.settings.OWNER_WHATSAPP_NUMBER.value === OWNER, "secrets hidden, number normalised");
  const v = await fetch(`${APP}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42`);
  ok(v.status === 200 && (await v.text()) === "42", "webhook verification handshake");
  await call("/api/settings/whatsapp-test", { method: "POST" });
  ok(lastWa()?.to === OWNER && waText(lastWa()).includes("MailBridge"), "test WhatsApp message delivered to owner");

  console.log("\n④ Email account CRUD");
  const cfg = { label: "Work", address: MAILBOX, username: MAILBOX, password: "pass", imapHost: "127.0.0.1", imapPort: P.imap, imapSecure: false, smtpHost: "127.0.0.1", smtpPort: P.smtp, smtpSecure: false, appendSent: false, signature: "-- Sent via MailBridge" };
  const badTest = await call("/api/accounts/test", { body: { ...cfg, password: "wrong" } });
  ok(!badTest.imap.ok, "connection test detects a wrong password");
  const goodTest = await call("/api/accounts/test", { body: cfg });
  ok(goodTest.imap.ok && goodTest.smtp.ok, "connection test passes for IMAP + SMTP");
  const acc = await call("/api/accounts", { body: cfg });
  ok(acc.isDefault && !("encPassword" in acc), "account created (default, password not exposed)");
  let dup = 0;
  try { await call("/api/accounts", { body: cfg }); } catch { dup = 1; }
  ok(dup, "duplicate address rejected");
  await waitFor(async () => (await call(`/api/accounts/${acc.id}`)).status === "connected", "worker connects to IMAP", 40000);
  ok(true, "worker connected to mailbox (IDLE)");
  const backfilled = await waitFor(async () => { const r = await call("/api/emails?box=inbox"); return r.total > 0 && r; }, "backfill");
  ok(backfilled.total > 0, `initial sync imported ${backfilled.total} existing email(s) without notifying`);
  const waBefore = waOutbox.length;

  console.log("\n⑤ Incoming email → AI summary → WhatsApp");
  const sender = nodemailer.createTransport({ host: "127.0.0.1", port: P.smtp, secure: false, ignoreTLS: true });
  await sender.sendMail({ from: "Alice <alice@example.com>", to: MAILBOX, subject: "Project meeting", text: "Hi, can we meet next week to discuss the project? Thanks, Alice", messageId: "<orig-1@example.com>" });
  if (process.env.E2E_VERBOSE) {
    const { ImapFlow } = await import("imapflow");
    const c = new ImapFlow({ host: "127.0.0.1", port: P.imap, secure: false, auth: { user: MAILBOX, pass: "pass" }, logger: false });
    await c.connect();
    console.log("[diag] IMAP status after send:", await c.status("INBOX", { messages: true, uidNext: true }), "smtp captured:", smtpOutbox.length);
    await c.logout();
  }
  const incoming = await waitFor(async () => (await call("/api/emails?box=inbox")).items.find((e: any) => e.subject === "Project meeting" && e.summary), "new email summarized", 30000);
  ok(incoming.summary.includes("AI summary") && incoming.priority === "high", "new email stored with AI summary + priority");
  const card = await waitFor(() => waOutbox.slice(waBefore).find((m: any) => m.type === "interactive" && waText(m).includes("Project meeting")) as any, "WhatsApp card");
  ok(card.interactive.action.buttons.length === 3 && waText(card).includes("AI summary"), "WhatsApp card with summary + 3 buttons sent");
  const cardId = card._id;

  console.log("\n⑥ WhatsApp: swipe-reply with AI prompt → draft → Send");
  const unsigned = await webhook({ type: "text", text: { body: "hello" } }, false);
  ok(unsigned.status === 401, "unsigned webhook rejected");
  let n = waOutbox.length;
  await webhook({ type: "text", text: { body: "accept, propose Tuesday 3pm" }, context: { id: cardId } });
  const preview = await waitFor(() => waOutbox.slice(n).find((m: any) => m.type === "interactive" && waText(m).includes("Draft")) as any, "draft preview");
  ok(waText(preview).includes("Tuesday at 3pm") && preview.interactive.action.buttons[0].reply.id.startsWith("send:"), "AI draft preview with Send/Edit/Cancel");
  const draftId = preview.interactive.action.buttons[0].reply.id.slice(5);
  ok(smtpOutbox.filter((m) => m.to.includes("alice@example.com")).length === 0, "nothing sent before approval");

  n = waOutbox.length;
  await webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: `edit:${draftId}`, title: "Edit" } } });
  await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("How should I change")), "edit prompt");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "make it shorter" } });
  const revised = await waitFor(() => waOutbox.slice(n).find((m: any) => m.type === "interactive" && waText(m).includes("Revised")) as any, "revised preview");
  ok(!!revised, "Edit → AI revision → new preview");

  n = waOutbox.length;
  const tap = { type: "interactive", interactive: { type: "button_reply", button_reply: { id: `send:${draftId}`, title: "Send" } } };
  await webhook(tap);
  await webhook(tap); // double tap must not send twice
  await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("✅ Sent")), "sent confirmation");
  await sleep(800);
  const replies = smtpOutbox.filter((m) => m.to.includes("alice@example.com"));
  ok(replies.length === 1, "reply sent exactly once (double tap safe)");
  ok(replies[0].inReplyTo === "<orig-1@example.com>" && replies[0].subject === "Re: Project meeting", "reply is threaded (In-Reply-To + Re: subject)");
  ok(replies[0].text.includes("Revised") && replies[0].text.includes("-- Sent via MailBridge"), "sent body = approved revision + signature");

  console.log("\n⑦ WhatsApp: manual reply via buttons, cancel flow");
  await sender.sendMail({ from: "Bob <bob@example.com>", to: MAILBOX, subject: "URGENT invoice", text: "Please pay the invoice today." });
  const card2 = await waitFor(() => waOutbox.find((m: any) => m.type === "interactive" && waText(m).includes("URGENT invoice")) as any, "card 2", 30000);
  n = waOutbox.length;
  await webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: card2.interactive.action.buttons[1].reply.id, title: "Reply myself" } } });
  await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("Type your reply")), "manual prompt");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "Paid it just now. Thanks!" } });
  const p2 = await waitFor(() => waOutbox.slice(n).find((m: any) => m.type === "interactive" && waText(m).includes("Paid it just now")) as any, "manual preview");
  const d2 = p2.interactive.action.buttons[2].reply.id; // cancel
  await webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: d2, title: "Cancel" } } });
  await waitFor(async () => (await call("/api/drafts?status=REJECTED")).length === 1, "draft rejected");
  ok(smtpOutbox.filter((m) => m.to.includes("bob@example.com")).length === 0, "cancelled draft is never sent");

  console.log("\n⑧ Contacts, groups & broadcast to everyone from WhatsApp");
  await call("/api/contacts/import", { body: { csv: "name,email\nPriya Sharma,priya@example.com\nRavi Kumar,ravi@example.com" } });
  const contacts = await call("/api/contacts");
  ok(contacts.length === 2, "CSV import creates contacts");
  const g = await call("/api/groups", { body: { name: "Team", contactIds: contacts.map((c: any) => c.id) } });
  await call(`/api/contacts/${contacts[0].id}`, { method: "PATCH", body: { name: "Priya S" } });
  ok((await call("/api/groups")).find((x: any) => x.id === g.id).memberCount === 2, "group CRUD with members");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "new all | Office closed Friday | tell everyone the office is closed Friday" } });
  const bp = await waitFor(() => waOutbox.slice(n).find((m: any) => m.type === "interactive" && waText(m).includes("Broadcast")) as any, "broadcast preview");
  ok(waText(bp).includes("2 individual emails"), "broadcast draft for all contacts");
  n = waOutbox.length;
  await webhook({ type: "interactive", interactive: { type: "button_reply", button_reply: { id: bp.interactive.action.buttons[0].reply.id, title: "Send" } } });
  await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("✅ Sent")), "broadcast confirmation");
  const priya = smtpOutbox.find((m) => m.to.length === 1 && m.to[0] === "priya@example.com");
  const ravi = smtpOutbox.find((m) => m.to.length === 1 && m.to[0] === "ravi@example.com");
  ok(priya?.text.startsWith("Hi Priya,") && ravi?.text.startsWith("Hi Ravi,"), "one personalised email per recipient ({{name}})");

  console.log("\n⑨ Other WhatsApp commands");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "help" } });
  await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("MailBridge commands")), "help");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "accounts" } });
  ok(!!(await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("Work") && waText(m).includes(MAILBOX)), "accounts")), "help + accounts commands answer");
  n = waOutbox.length;
  await webhook({ type: "text", text: { body: "send nobody | x | y" } });
  ok(!!(await waitFor(() => waOutbox.slice(n).find((m: any) => waText(m).includes("couldn't find any recipients")), "unknown")), "unknown recipient handled gracefully");
  const before = waOutbox.length;
  const strangerPayload = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ id: "wamid.stranger", from: "15550001111", type: "text", text: { body: "send all | hacked | hacked" } }] } }] }] });
  await fetch(`${APP}/api/whatsapp/webhook`, { method: "POST", headers: { "Content-Type": "application/json", "x-hub-signature-256": "sha256=" + createHmac("sha256", APP_SECRET).update(strangerPayload).digest("hex") }, body: strangerPayload });
  await sleep(1500);
  ok(waOutbox.length === before && !smtpOutbox.some((m) => m.subject === "hacked"), "messages from other numbers are ignored");

  console.log("\n⑩ Dashboard: compose, approvals, inbox actions");
  const sent = await call("/api/drafts", { body: { accountId: acc.id, target: "emails", to: "carol@example.com", subject: "Hello Carol", body: "Hi Carol!", sendNow: true } });
  ok(sent.result?.ok && smtpOutbox.some((m) => m.to.includes("carol@example.com")), "compose → send now");
  const saved = await call("/api/drafts", { body: { accountId: acc.id, target: "group", groupId: g.id, subject: "Team update", body: "Hi {{name}}, update!", sendNow: false } });
  ok(saved.draft.status === "PENDING_APPROVAL" && saved.draft.mode === "BROADCAST", "compose → save for approval (group)");
  await call(`/api/drafts/${saved.draft.id}`, { method: "PATCH", body: { body: "Hi {{name}}, edited update!" } });
  await call(`/api/drafts/${saved.draft.id}/send`, { method: "POST" });
  ok(smtpOutbox.filter((m) => m.subject === "Team update" && m.text.includes("edited update")).length === 2, "edit + approve from dashboard sends to group");
  const ai = await call("/api/ai/draft", { body: { kind: "reply", emailId: incoming.id, prompt: "say yes" } });
  ok(ai.body.includes("Tuesday"), "AI reply generation in dashboard");
  const sentBox = await call("/api/emails?box=sent");
  ok(sentBox.total >= 4, "sent emails recorded in Sent box");
  await call(`/api/emails/${incoming.id}`, { method: "PATCH", body: { isArchived: true } });
  ok((await call("/api/emails?box=archived")).items.some((e: any) => e.id === incoming.id), "archive");
  ok((await call("/api/emails?q=invoice")).items.length === 1, "search");
  await call(`/api/emails/${incoming.id}`, { method: "DELETE" });
  ok(!(await call("/api/emails?box=archived")).items.some((e: any) => e.id === incoming.id), "delete email");

  console.log("\n⑪ Account update/disable/delete");
  await call(`/api/accounts/${acc.id}`, { method: "PATCH", body: { label: "Office", isActive: false } });
  await waitFor(async () => (await call(`/api/accounts/${acc.id}`)).status === "disabled", "disabled", 30000);
  ok(true, "disabling an account stops its watcher");
  await call(`/api/accounts/${acc.id}`, { method: "DELETE" });
  ok((await call("/api/accounts")).length === 0, "account deleted");

  console.log("\n⑫ Serverless mode (Vercel): sync URL instead of the worker");
  try { process.kill(-worker.pid!, "SIGKILL"); } catch { /* gone */ }
  await sleep(500);
  const settings2 = await call("/api/settings");
  const syncUrl: string = settings2.syncUrl.replace(/^https?:\/\/[^/]+/, APP);
  ok(/key=[\w-]{20,}/.test(syncUrl), "a secret sync URL is generated and shown in Settings");
  const noKey = await fetch(`${APP}/api/cron/sync`);
  const badKey = await fetch(`${APP}/api/cron/sync?key=wrong`);
  ok(noKey.status === 401 && badKey.status === 401, "sync URL rejects missing/wrong key");
  const acc2 = await call("/api/accounts", { body: { ...cfg, label: "Cloud" } });
  const first = await (await fetch(syncUrl)).json();
  ok(first.results[0].ok && first.results[0].initial && (await call(`/api/accounts/${acc2.id}`)).status === "connected", "first scheduled sync connects + imports silently");
  const waN = waOutbox.length;
  await sender.sendMail({ from: "Dana <dana@example.com>", to: MAILBOX, subject: "Serverless hello", text: "Does polling work?" });
  await sleep(500);
  const bearer = await (await fetch(`${APP}/api/cron/sync`, { headers: { Authorization: `Bearer ${new URL(syncUrl).searchParams.get("key")}` } })).json();
  ok(bearer.results[0].newEmails === 1, "next scheduled sync (Bearer auth) picks up the new email");
  ok(waOutbox.slice(waN).some((m: any) => waText(m).includes("Serverless hello")), "…and sends its WhatsApp summary");
  const again = await (await fetch(syncUrl)).json();
  ok(again.results[0].newEmails === 0, "repeat sync does not duplicate");
  const manual = await call("/api/sync", { body: { accountId: acc2.id } });
  ok(manual.results[0].ok, "dashboard 'Sync now' works");
  ok((await call("/api/emails?q=serverless")).items.length === 1, "case-insensitive search on Postgres");
  ok(aiCalls.length > 0, `AI mock called ${aiCalls.length} times`);

  console.log(`\n🎉 All ${passed} checks passed`);
}

function killAll() {
  for (const p of procs) {
    try { process.kill(-p.pid!, "SIGKILL"); } catch { /* already gone */ }
  }
}
main()
  .then(() => { killAll(); process.exit(0); })
  .catch((e) => { console.error("\n" + (e?.stack ?? e)); killAll(); process.exit(1); });
