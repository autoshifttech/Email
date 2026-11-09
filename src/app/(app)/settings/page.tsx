"use client";
import { useEffect, useState } from "react";
import { api, useApi } from "@/lib/client";
import { Field, Loading, PageHeader, Spinner, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";

type S = Record<string, { value: string; secret: boolean; isSet: boolean; hint?: string }>;

export default function SettingsPage() {
  const toast = useToast();
  const { data, reload } = useApi<{ settings: S; webhookUrl: string }>("/api/settings");
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" });

  useEffect(() => {
    if (data) setV(Object.fromEntries(Object.entries(data.settings).map(([k, s]) => [k, s.secret ? "" : s.value])));
  }, [data]);
  if (!data) return <Loading />;
  const s = data.settings;
  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));

  const save = async (section: string, keys: string[]) => {
    setBusy(section);
    try {
      await api("/api/settings", { method: "PUT", body: { values: Object.fromEntries(keys.map((k) => [k, v[k] ?? ""])) } });
      toast("success", "Settings saved");
      reload();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const testWa = async () => {
    setBusy("watest");
    try {
      await api("/api/settings/whatsapp-test", { method: "POST" });
      toast("success", "Test message sent – check WhatsApp");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const changePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("pw");
    try {
      await api("/api/auth/password", { body: pw });
      setPw({ current: "", next: "" });
      toast("success", "Password changed");
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const secret = (k: string, label: string) => (
    <Field label={label} hint={s[k].isSet ? `Saved (${s[k].hint}). Leave blank to keep.` : "Not set"}>
      <input className="input font-mono" type="password" autoComplete="off" value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} />
    </Field>
  );
  const WA = ["WA_PHONE_NUMBER_ID", "WA_ACCESS_TOKEN", "WA_APP_SECRET", "WA_VERIFY_TOKEN", "OWNER_WHATSAPP_NUMBER", "WA_TEMPLATE_NAME", "WA_TEMPLATE_LANG"];
  const NOTIFY = ["WA_NOTIFICATIONS_ENABLED", "NOTIFY_MIN_PRIORITY", "QUIET_HOURS_START", "QUIET_HOURS_END", "TIMEZONE"];
  const AI = ["OWNER_NAME", "AI_TONE", "AI_LANGUAGE"];

  return (
    <>
      <PageHeader title="Settings" />
      <div className="space-y-5 max-w-3xl">
        <section className="glass p-5 space-y-4">
          <div>
            <h2 className="font-semibold">💬 WhatsApp (Meta Cloud API)</h2>
            <p className="text-sm muted">From developers.facebook.com → your app → WhatsApp → API Setup. See README for the step-by-step guide.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Your WhatsApp number" hint="Summaries go here, and only this number can give commands. Include the country code, e.g. 919876543210">
              <input className="input" value={v.OWNER_WHATSAPP_NUMBER ?? ""} onChange={(e) => set("OWNER_WHATSAPP_NUMBER", e.target.value)} placeholder="919876543210" />
            </Field>
            <Field label="Phone number ID"><input className="input" value={v.WA_PHONE_NUMBER_ID ?? ""} onChange={(e) => set("WA_PHONE_NUMBER_ID", e.target.value)} /></Field>
            {secret("WA_ACCESS_TOKEN", "Access token (permanent system-user token recommended)")}
            {secret("WA_APP_SECRET", "App secret (verifies webhook signatures)")}
            <Field label="Webhook verify token" hint="Any string you choose; enter the same one in Meta"><input className="input" value={v.WA_VERIFY_TOKEN ?? ""} onChange={(e) => set("WA_VERIFY_TOKEN", e.target.value)} /></Field>
            <Field label="Webhook callback URL" hint="Paste into Meta → WhatsApp → Configuration. Subscribe to “messages”.">
              <div className="flex gap-2"><input className="input text-xs" readOnly value={data.webhookUrl} /><button type="button" className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(data.webhookUrl); toast("success", "Copied"); }}>Copy</button></div>
            </Field>
            <Field label="Alert template name" hint="Used when you haven't messaged the bot in 24h (Meta rule)"><input className="input" value={v.WA_TEMPLATE_NAME ?? ""} onChange={(e) => set("WA_TEMPLATE_NAME", e.target.value)} /></Field>
            <Field label="Template language"><input className="input" value={v.WA_TEMPLATE_LANG ?? ""} onChange={(e) => set("WA_TEMPLATE_LANG", e.target.value)} /></Field>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="btn" onClick={testWa} disabled={busy === "watest"}>{busy === "watest" && <Spinner />} Send test message</button>
            <button className="btn btn-primary" onClick={() => save("wa", WA)} disabled={busy === "wa"}>{busy === "wa" && <Spinner />} Save WhatsApp settings</button>
          </div>
        </section>

        <section className="glass p-5 space-y-4">
          <h2 className="font-semibold">🔔 Notification rules</h2>
          <Toggle checked={v.WA_NOTIFICATIONS_ENABLED !== "false"} onChange={(x) => set("WA_NOTIFICATIONS_ENABLED", x ? "true" : "false")} label="Forward new emails to WhatsApp" />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Only forward emails with priority" hint="The AI rates every email">
              <select className="input" value={v.NOTIFY_MIN_PRIORITY ?? "low"} onChange={(e) => set("NOTIFY_MIN_PRIORITY", e.target.value)}>
                <option value="low">All emails</option>
                <option value="normal">Normal and above (skip newsletters/promos)</option>
                <option value="high">High and urgent only</option>
                <option value="urgent">Urgent only</option>
              </select>
            </Field>
            <Field label="Timezone" hint="e.g. Asia/Kolkata"><input className="input" value={v.TIMEZONE ?? ""} onChange={(e) => set("TIMEZONE", e.target.value)} /></Field>
            <Field label="Quiet hours start" hint="No alerts in this window (urgent still comes through)"><input className="input" type="time" value={v.QUIET_HOURS_START ?? ""} onChange={(e) => set("QUIET_HOURS_START", e.target.value)} /></Field>
            <Field label="Quiet hours end"><input className="input" type="time" value={v.QUIET_HOURS_END ?? ""} onChange={(e) => set("QUIET_HOURS_END", e.target.value)} /></Field>
          </div>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={() => save("notify", NOTIFY)} disabled={busy === "notify"}>{busy === "notify" && <Spinner />} Save</button></div>
        </section>

        <section className="glass p-5 space-y-4">
          <h2 className="font-semibold">✍️ AI writing style</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Your name (email sign-off)"><input className="input" value={v.OWNER_NAME ?? ""} onChange={(e) => set("OWNER_NAME", e.target.value)} /></Field>
            <Field label="Language"><input className="input" value={v.AI_LANGUAGE ?? ""} onChange={(e) => set("AI_LANGUAGE", e.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Tone"><input className="input" value={v.AI_TONE ?? ""} onChange={(e) => set("AI_TONE", e.target.value)} /></Field></div>
          </div>
          <div className="flex justify-end"><button className="btn btn-primary" onClick={() => save("ai", AI)} disabled={busy === "ai"}>{busy === "ai" && <Spinner />} Save</button></div>
        </section>

        <form onSubmit={changePw} className="glass p-5 space-y-4">
          <h2 className="font-semibold">🔒 Change password</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Current password"><input className="input" type="password" required value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></Field>
            <Field label="New password"><input className="input" type="password" required minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></Field>
          </div>
          <div className="flex justify-end"><button className="btn btn-primary" disabled={busy === "pw"}>{busy === "pw" && <Spinner />} Change password</button></div>
        </form>
      </div>
    </>
  );
}
