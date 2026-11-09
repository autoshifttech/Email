import { NextResponse } from "next/server";
import { z } from "zod";
import { body, handle } from "@/lib/api";
import { SETTINGS, getPublicSettings, getSyncSecret, setSetting, type SettingKey } from "@/lib/settings";

export const GET = handle(async () => {
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return NextResponse.json({
    settings: await getPublicSettings(),
    webhookUrl: `${appUrl}/api/whatsapp/webhook`,
    syncUrl: `${appUrl}/api/cron/sync?key=${await getSyncSecret()}`,
    serverless: !!process.env.VERCEL,
  });
});

/** PUT { values: { KEY: "value" } }. Secret fields left blank are not changed. */
export const PUT = handle(async (req: Request) => {
  const { values } = await body(req, z.object({ values: z.record(z.string(), z.string()) }));
  for (const [k, v] of Object.entries(values)) {
    if (!(k in SETTINGS) || k === "SYNC_SECRET") continue;
    const key = k as SettingKey;
    if (SETTINGS[key].secret && v === "") continue;
    await setSetting(key, key === "OWNER_WHATSAPP_NUMBER" ? v.replace(/\D/g, "") : v.trim());
  }
  return NextResponse.json({ settings: await getPublicSettings() });
});
