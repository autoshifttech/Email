/**
 * Test doubles for the E2E run:
 *  - SMTP server (captures outgoing mail; mail to the test mailbox is delivered into the IMAP server)
 *  - OpenAI-compatible AI API
 *  - WhatsApp Graph API
 */
import http from "node:http";
import { SMTPServer } from "smtp-server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export type Captured = { from: string; to: string[]; subject: string; text: string; inReplyTo?: string; raw: string };
export const smtpOutbox: Captured[] = [];
export const waOutbox: Record<string, unknown>[] = [];
export const aiCalls: { system: string; user: string }[] = [];

export function startSmtp(port: number, imap: { host: string; port: number; user: string; pass: string }) {
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(_auth, _session, cb) { cb(null, { user: "ok" }); },
    onData(stream, session, cb) {
      const chunks: Buffer[] = [];
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("end", async () => {
        const raw = Buffer.concat(chunks);
        const m = await simpleParser(raw);
        const to = session.envelope.rcptTo.map((r) => r.address.toLowerCase());
        smtpOutbox.push({ from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "", to, subject: m.subject ?? "", text: m.text ?? "", inReplyTo: m.inReplyTo, raw: raw.toString() });
        if (to.includes(imap.user)) {
          const c = new ImapFlow({ host: imap.host, port: imap.port, secure: false, auth: { user: imap.user, pass: imap.pass }, logger: false });
          await c.connect();
          await c.append("INBOX", raw);
          await c.logout();
        }
        cb();
      });
    },
  });
  server.listen(port);
  return server;
}

function json(res: http.ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
}

export function startAi(port: number) {
  return http.createServer(async (req, res) => {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (req.headers.authorization !== "Bearer test-ai-key") return json(res, 401, { error: { message: "Invalid API key" } });
    const system: string = body.messages?.[0]?.content ?? "";
    const user: string = body.messages?.[1]?.content ?? "";
    aiCalls.push({ system, user });
    let content: string;
    if (system.includes("Reply with exactly: OK")) content = "OK";
    else if (system.includes("summarize emails")) {
      const subj = /Subject: (.*)/.exec(user)?.[1] ?? "";
      content = JSON.stringify({ summary: `AI summary of "${subj}": they ask to meet next week.`, priority: subj.includes("URGENT") ? "urgent" : "high", category: "work", actionNeeded: true });
    } else if (system.includes("revise an email draft")) {
      const subj = /Subject: (.*)/.exec(user)?.[1] ?? "";
      content = JSON.stringify({ subject: subj, body: "Revised: shorter reply. Tuesday works.\n\nBest, Owner" });
    } else if (system.includes("write email replies")) {
      content = JSON.stringify({ subject: "Re: Project meeting", body: "Hi Alice,\n\nThanks! Tuesday at 3pm works for me.\n\nBest, Owner" });
    } else if (system.includes("write new emails")) {
      const broadcast = system.includes("{{name}}");
      content = JSON.stringify({ subject: "Office closed Friday", body: `${broadcast ? "Hi {{name}}," : "Hi,"}\n\nThe office is closed this Friday for maintenance.\n\nBest, Owner` });
    } else content = "{}";
    json(res, 200, { id: "x", object: "chat.completion", created: 0, model: body.model, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }] });
  }).listen(port);
}

let waSeq = 0;
export function startWhatsApp(port: number) {
  return http.createServer(async (req, res) => {
    const body = JSON.parse((await readBody(req)) || "{}");
    if (req.headers.authorization !== "Bearer test-wa-token") return json(res, 401, { error: { message: "bad token", code: 190 } });
    const id = `wamid.out.${++waSeq}`;
    waOutbox.push({ ...body, _id: id });
    json(res, 200, { messaging_product: "whatsapp", contacts: [{ wa_id: body.to }], messages: [{ id }] });
  }).listen(port);
}
