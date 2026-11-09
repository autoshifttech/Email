import { NextResponse, after } from "next/server";
import { prisma, logActivity } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { verifyMetaSignature } from "@/lib/crypto";
import { digits, extractMessages, sendText } from "@/lib/whatsapp";
import { handleIncoming } from "@/lib/commands";
import { rateLimit } from "@/lib/auth";

/** Meta webhook verification handshake. */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  const { WA_VERIFY_TOKEN } = await getSettings(["WA_VERIFY_TOKEN"] as const);
  if (u.get("hub.mode") === "subscribe" && WA_VERIFY_TOKEN && u.get("hub.verify_token") === WA_VERIFY_TOKEN) {
    return new Response(u.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/** Incoming WhatsApp messages. Always answer 200 quickly; work continues after the response. */
export async function POST(req: Request) {
  if (!rateLimit("wa-webhook", 600, 60_000)) return new Response("Too many requests", { status: 429 });
  const raw = await req.text();
  const s = await getSettings(["WA_APP_SECRET", "OWNER_WHATSAPP_NUMBER"] as const);
  if (s.WA_APP_SECRET && !verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), s.WA_APP_SECRET)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const owner = digits(s.OWNER_WHATSAPP_NUMBER);
  for (const msg of extractMessages(payload)) {
    // De-duplicate: Meta may deliver the same message more than once.
    try {
      await prisma.waProcessed.create({ data: { id: msg.id } });
    } catch {
      continue;
    }
    if (!owner || digits(msg.from) !== owner) {
      await logActivity("security", `Ignored WhatsApp message from non-owner number ${msg.from}`);
      continue;
    }
    after(() => handleIncoming(msg).catch(() => sendText("⚠️ Something went wrong.").catch(() => {})));
  }
  // Housekeeping: forget processed ids older than 7 days.
  after(() => prisma.waProcessed.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 864e5) } } }).then(() => undefined));
  return NextResponse.json({ ok: true });
}
