import OpenAI from "openai";
import { prisma } from "./db";
import { decrypt } from "./crypto";
import { getSettings } from "./settings";

export type AiConfig = { name: string; baseUrl: string; model: string; apiKey: string; source: "dashboard" | "env" };

/** Active provider from the dashboard, falling back to AI_* env variables. */
export async function getAiConfig(): Promise<AiConfig | null> {
  const p = await prisma.aiProvider.findFirst({ where: { isActive: true } });
  if (p) {
    let apiKey = "";
    try {
      apiKey = decrypt(p.encApiKey);
    } catch {
      /* ignore */
    }
    return { name: p.name, baseUrl: p.baseUrl, model: p.model, apiKey, source: "dashboard" };
  }
  if (process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_MODEL) {
    return {
      name: "Environment",
      baseUrl: process.env.AI_BASE_URL,
      model: process.env.AI_MODEL,
      apiKey: process.env.AI_API_KEY,
      source: "env",
    };
  }
  return null;
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super("No AI provider configured. Add an API key on the AI Keys page.");
  }
}

async function chat(system: string, user: string, opts: { json?: boolean; config?: AiConfig } = {}): Promise<string> {
  const cfg = opts.config ?? (await getAiConfig());
  if (!cfg) throw new AiNotConfiguredError();
  const client = new OpenAI({ baseURL: cfg.baseUrl, apiKey: cfg.apiKey || "none", timeout: 60_000, maxRetries: 2 });
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  try {
    const res = await client.chat.completions.create({
      model: cfg.model,
      messages,
      temperature: 0.4,
      ...(opts.json ? { response_format: { type: "json_object" as const } } : {}),
    });
    return res.choices[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    // Some providers/models don't support response_format; retry once without it.
    if (opts.json && e instanceof OpenAI.APIError && e.status === 400) {
      const res = await client.chat.completions.create({ model: cfg.model, messages, temperature: 0.4 });
      return res.choices[0]?.message?.content?.trim() ?? "";
    }
    throw e;
  }
}

/** Extract the first JSON object from a model response (handles ```json fences). */
export function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n) + "\n[...truncated]" : s);

export type EmailInput = { fromName: string; fromAddress: string; to: string; subject: string; text: string; receivedAt?: Date };
export type Summary = { summary: string; priority: "low" | "normal" | "high" | "urgent"; category: string; actionNeeded: boolean };

export async function summarizeEmail(email: EmailInput): Promise<Summary> {
  const system =
    "You summarize emails for a busy person who reads them on WhatsApp. " +
    'Respond ONLY with JSON: {"summary": string, "priority": "low"|"normal"|"high"|"urgent", "category": string, "actionNeeded": boolean}. ' +
    "summary: 1-3 short sentences (max 60 words) with the key point, any request, deadline, amount or date. " +
    "category: one word such as work, personal, finance, newsletter, promotion, notification, support, sales, other. " +
    "Newsletters/promotions are low priority.";
  const user = `From: ${email.fromName} <${email.fromAddress}>\nTo: ${email.to}\nSubject: ${email.subject}\n\n${clip(email.text, 8000)}`;
  const raw = await chat(system, user, { json: true });
  const parsed = parseJsonLoose<Partial<Summary>>(raw);
  const priority = ["low", "normal", "high", "urgent"].includes(String(parsed?.priority)) ? (parsed!.priority as Summary["priority"]) : "normal";
  return {
    summary: (parsed?.summary || raw || "").toString().slice(0, 800),
    priority,
    category: (parsed?.category || "other").toString().toLowerCase().slice(0, 30),
    actionNeeded: Boolean(parsed?.actionNeeded),
  };
}

async function styleRules() {
  const s = await getSettings(["AI_TONE", "AI_LANGUAGE", "OWNER_NAME"] as const);
  return (
    `Tone: ${s.AI_TONE}. Language: ${s.AI_LANGUAGE}. ` +
    (s.OWNER_NAME ? `The sender's name is ${s.OWNER_NAME}; sign off with it. ` : "Sign off naturally without inventing a name. ") +
    "Never invent facts, prices, dates or commitments that were not given in the instructions. Plain text only, no markdown."
  );
}

export type DraftOut = { subject: string; body: string };

export async function draftReply(email: EmailInput, instructions: string): Promise<DraftOut> {
  const system =
    "You write email replies on behalf of the user. " +
    (await styleRules()) +
    ' Respond ONLY with JSON: {"subject": string, "body": string}. subject should be "Re: <original subject>" unless told otherwise. body is the reply text without the quoted original.';
  const user =
    `ORIGINAL EMAIL\nFrom: ${email.fromName} <${email.fromAddress}>\nSubject: ${email.subject}\n\n${clip(email.text, 6000)}\n\n` +
    `USER INSTRUCTIONS FOR THE REPLY:\n${instructions.trim() || "Write an appropriate reply."}`;
  const raw = await chat(system, user, { json: true });
  const p = parseJsonLoose<DraftOut>(raw);
  const subj = email.subject.toLowerCase().startsWith("re:") ? email.subject : `Re: ${email.subject}`;
  return { subject: p?.subject?.trim() || subj, body: (p?.body ?? raw).trim() };
}

export async function draftNew(instructions: string, opts: { subject?: string; broadcast?: boolean; recipientHint?: string } = {}): Promise<DraftOut> {
  const system =
    "You write new emails on behalf of the user. " +
    (await styleRules()) +
    (opts.broadcast
      ? ' This email goes to many recipients individually: greet with "Hi {{name}}," exactly (the placeholder is replaced per recipient). '
      : "") +
    ' Respond ONLY with JSON: {"subject": string, "body": string}.';
  const user =
    (opts.recipientHint ? `Recipient(s): ${opts.recipientHint}\n` : "") +
    (opts.subject ? `Subject must be: ${opts.subject}\n` : "Write a clear subject line.\n") +
    `INSTRUCTIONS:\n${instructions}`;
  const raw = await chat(system, user, { json: true });
  const p = parseJsonLoose<DraftOut>(raw);
  return { subject: opts.subject || p?.subject?.trim() || "(no subject)", body: (p?.body ?? raw).trim() };
}

export async function reviseDraft(draft: DraftOut, instructions: string): Promise<DraftOut> {
  const system =
    "You revise an email draft according to the user's instructions. Keep everything the user did not ask to change, including any {{name}} placeholder. " +
    (await styleRules()) +
    ' Respond ONLY with JSON: {"subject": string, "body": string}.';
  const user = `CURRENT DRAFT\nSubject: ${draft.subject}\n\n${draft.body}\n\nCHANGES REQUESTED:\n${instructions}`;
  const raw = await chat(system, user, { json: true });
  const p = parseJsonLoose<DraftOut>(raw);
  return { subject: p?.subject?.trim() || draft.subject, body: (p?.body ?? raw).trim() };
}

/** Used by the "Test" button on the AI Keys page. */
export async function testAiConfig(cfg: AiConfig): Promise<{ ok: boolean; message: string; ms: number }> {
  const t = Date.now();
  try {
    const out = await chat("Reply with exactly: OK", "ping", { config: cfg });
    return { ok: true, message: `Model replied: ${out.slice(0, 60)}`, ms: Date.now() - t };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e), ms: Date.now() - t };
  }
}
