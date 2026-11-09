import { prisma } from "./db";
import { decrypt, encrypt, keyHint } from "./crypto";

/** Every setting the dashboard can manage. env = fallback environment variable. */
export const SETTINGS = {
  WA_PHONE_NUMBER_ID: { secret: false, env: "WA_PHONE_NUMBER_ID", default: "" },
  WA_ACCESS_TOKEN: { secret: true, env: "WA_ACCESS_TOKEN", default: "" },
  WA_APP_SECRET: { secret: true, env: "WA_APP_SECRET", default: "" },
  WA_VERIFY_TOKEN: { secret: false, env: "WA_VERIFY_TOKEN", default: "" },
  OWNER_WHATSAPP_NUMBER: { secret: false, env: "OWNER_WHATSAPP_NUMBER", default: "" },
  WA_TEMPLATE_NAME: { secret: false, env: "WA_TEMPLATE_NAME", default: "new_email_alert" },
  WA_TEMPLATE_LANG: { secret: false, env: "WA_TEMPLATE_LANG", default: "en" },
  WA_NOTIFICATIONS_ENABLED: { secret: false, env: "", default: "true" },
  NOTIFY_MIN_PRIORITY: { secret: false, env: "", default: "low" }, // low|normal|high|urgent
  QUIET_HOURS_START: { secret: false, env: "", default: "" }, // "22:00"
  QUIET_HOURS_END: { secret: false, env: "", default: "" }, // "07:00"
  TIMEZONE: { secret: false, env: "TZ", default: "UTC" },
  OWNER_NAME: { secret: false, env: "", default: "" },
  AI_TONE: { secret: false, env: "", default: "professional, friendly and concise" },
  AI_LANGUAGE: { secret: false, env: "", default: "same language as the original email" },
  SYNC_SECRET: { secret: true, env: "CRON_SECRET", default: "" },
} as const;

export type SettingKey = keyof typeof SETTINGS;

export async function getSetting(key: SettingKey): Promise<string> {
  const def = SETTINGS[key];
  const row = await prisma.setting.findUnique({ where: { key } });
  if (row && row.value !== "") {
    try {
      return def.secret ? decrypt(row.value) : row.value;
    } catch {
      return "";
    }
  }
  if (def.env && process.env[def.env]) return process.env[def.env] as string;
  return def.default;
}

export async function getSettings<K extends SettingKey>(keys: readonly K[]): Promise<Record<K, string>> {
  const out = {} as Record<K, string>;
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

export async function setSetting(key: SettingKey, value: string) {
  const def = SETTINGS[key];
  const stored = def.secret ? encrypt(value) : value;
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: stored, secret: def.secret },
    update: { value: stored, secret: def.secret },
  });
}

/** Settings safe to send to the browser: secrets are replaced by a hint. */
export async function getPublicSettings() {
  const out: Record<string, { value: string; secret: boolean; isSet: boolean; hint?: string }> = {};
  for (const key of Object.keys(SETTINGS) as SettingKey[]) {
    if (key === "SYNC_SECRET") continue;
    const v = await getSetting(key);
    if (SETTINGS[key].secret) out[key] = { value: "", secret: true, isSet: !!v, hint: keyHint(v) };
    else out[key] = { value: v, secret: false, isSet: !!v };
  }
  return out;
}

/** Secret for the scheduled sync URL (env CRON_SECRET, or generated once and stored encrypted). */
export async function getSyncSecret(): Promise<string> {
  let v = await getSetting("SYNC_SECRET");
  if (!v) {
    const { randomBytes } = await import("node:crypto");
    v = randomBytes(24).toString("base64url");
    await setSetting("SYNC_SECRET", v);
  }
  return v;
}
