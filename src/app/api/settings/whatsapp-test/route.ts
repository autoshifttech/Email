import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { sendText } from "@/lib/whatsapp";

export const POST = handle(async () => {
  const id = await sendText("👋 Hello from *MailBridge*! Your WhatsApp connection works.\n\nSend *help* to see what I can do.");
  return NextResponse.json({ ok: true, id });
});
