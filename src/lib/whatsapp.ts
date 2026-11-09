import { getSettings } from "./settings";

const GRAPH = process.env.WA_GRAPH_URL || "https://graph.facebook.com/v23.0";

export const digits = (s: string) => (s || "").replace(/\D/g, "");

export class WhatsAppError extends Error {
  constructor(message: string, public code?: number, public status?: number) {
    super(message);
  }
}

/** Error codes meaning "outside the 24h customer-service window" -> must use a template. */
export const REENGAGEMENT_CODES = [131047, 131026];

export type Button = { id: string; title: string };

async function config() {
  const s = await getSettings(["WA_PHONE_NUMBER_ID", "WA_ACCESS_TOKEN", "OWNER_WHATSAPP_NUMBER"] as const);
  return s;
}

export async function isWhatsAppConfigured() {
  const s = await config();
  return !!(s.WA_PHONE_NUMBER_ID && s.WA_ACCESS_TOKEN && s.OWNER_WHATSAPP_NUMBER);
}

async function post(payload: Record<string, unknown>): Promise<string> {
  const s = await config();
  if (!s.WA_PHONE_NUMBER_ID || !s.WA_ACCESS_TOKEN) throw new WhatsAppError("WhatsApp is not configured (Settings → WhatsApp).");
  const to = digits((payload.to as string) || s.OWNER_WHATSAPP_NUMBER);
  if (!to) throw new WhatsAppError("Owner WhatsApp number is not set.");
  const res = await fetch(`${GRAPH}/${s.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${s.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...payload, to }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message: string; code: number; error_data?: { details?: string } };
  };
  if (!res.ok || data.error) {
    const msg = data.error?.error_data?.details || data.error?.message || `HTTP ${res.status}`;
    throw new WhatsAppError(msg, data.error?.code, res.status);
  }
  return data.messages?.[0]?.id ?? "";
}

const trim = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

/** Plain text (max 4096 chars). Long texts are split. Returns the id of the last message. */
export async function sendText(body: string, to?: string): Promise<string> {
  let id = "";
  for (let i = 0; i < Math.max(body.length, 1); i += 4000) {
    id = await post({ to, type: "text", text: { body: body.slice(i, i + 4000), preview_url: false } });
  }
  return id;
}

/** Interactive message with up to 3 reply buttons. Body max 1024 chars. */
export async function sendButtons(body: string, buttons: Button[], opts: { header?: string; footer?: string; to?: string } = {}) {
  return post({
    to: opts.to,
    type: "interactive",
    interactive: {
      type: "button",
      ...(opts.header ? { header: { type: "text", text: trim(opts.header, 60) } } : {}),
      body: { text: trim(body, 1024) },
      ...(opts.footer ? { footer: { text: trim(opts.footer, 60) } } : {}),
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id.slice(0, 256), title: trim(b.title, 20) } })),
      },
    },
  });
}

/** Approved template message (needed outside the 24h window). Params must not contain newlines. */
export async function sendTemplate(name: string, lang: string, params: string[], to?: string) {
  const clean = params.map((p) => trim((p || "-").replace(/[\n\t]+/g, " ").replace(/ {4,}/g, "   "), 900));
  return post({
    to,
    type: "template",
    template: {
      name,
      language: { code: lang },
      components: [{ type: "body", parameters: clean.map((text) => ({ type: "text", text })) }],
    },
  });
}

// ---------- Incoming webhook payload types ----------
export type WaIncoming = {
  id: string;
  from: string;
  timestamp: string;
  type: string;
  text?: { body: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
  button?: { payload: string; text: string };
  context?: { id: string; from?: string };
};

export function extractMessages(body: unknown): WaIncoming[] {
  const out: WaIncoming[] = [];
  const b = body as { entry?: { changes?: { value?: { messages?: WaIncoming[] } }[] }[] };
  for (const e of b?.entry ?? []) for (const c of e.changes ?? []) for (const m of c.value?.messages ?? []) out.push(m);
  return out;
}
