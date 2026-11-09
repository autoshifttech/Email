"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, useApi, timeAgo } from "@/lib/client";
import { MAIL_PRESETS } from "@/lib/mail-presets";
import { Badge, Empty, Field, Loading, Modal, PageHeader, Spinner, StatusBadge, Toggle } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { PublicAccount } from "@/lib/serialize";

type Account = PublicAccount & { unread: number };
type TestResult = { imap: { ok: boolean; message: string }; smtp: { ok: boolean; message: string } };

const blank = {
  label: "", address: "", displayName: "", preset: "gmail", username: "", password: "",
  imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true,
  smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true,
  appendSent: false, isActive: true, isDefault: false, notifyOnWhatsApp: true, signature: "",
};
type Form = typeof blank;

export default function AccountsPage() {
  const toast = useToast();
  const welcome = useSearchParams().get("welcome");
  const { data, loading, reload } = useApi<Account[]>("/api/accounts", { poll: 10_000 });
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);

  const patch = async (a: Account, body: Partial<Form>) => {
    try {
      await api(`/api/accounts/${a.id}`, { method: "PATCH", body });
      reload();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };
  const remove = async (a: Account) => {
    if (!confirm(`Delete ${a.address}? Its stored emails and drafts in MailBridge will be removed (nothing is deleted on the mail server).`)) return;
    await api(`/api/accounts/${a.id}`, { method: "DELETE" });
    toast("success", "Account deleted");
    reload();
  };

  return (
    <>
      <PageHeader
        title="Email Accounts"
        subtitle="Add, edit and manage the mailboxes MailBridge watches"
        actions={<button className="btn btn-primary" onClick={() => setEditing({ form: { ...blank } })}>+ Add account</button>}
      />
      {welcome && !data?.length && (
        <div className="panel p-4 mb-4 text-sm">👋 Welcome! Start by adding the email account you want forwarded to WhatsApp.</div>
      )}
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty icon="📧" title="No email accounts yet" text="Add Gmail, Outlook, Zoho or any IMAP/SMTP mailbox. New emails will be summarized and sent to your WhatsApp." action={<button className="btn btn-primary" onClick={() => setEditing({ form: { ...blank } })}>+ Add your first account</button>} />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {data.map((a) => (
            <div key={a.id} className="panel p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center font-bold text-green-800 dark:text-green-300">
                  {a.label.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{a.label}</span>
                    <StatusBadge s={a.status} />
                    {a.isDefault && <Badge color="purple">Default</Badge>}
                    {a.unread > 0 && <Badge color="green">{a.unread} unread</Badge>}
                  </div>
                  <div className="text-sm muted truncate">{a.address}</div>
                  <div className="text-xs muted">{a.imapHost} · {a.lastSyncAt ? `synced ${timeAgo(a.lastSyncAt)}` : "never synced"}</div>
                </div>
              </div>
              {a.lastError && a.status === "error" && <div className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{a.lastError}</div>}
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                <Toggle checked={a.isActive} onChange={(v) => patch(a, { isActive: v })} label="Active" />
                <Toggle checked={a.notifyOnWhatsApp} onChange={(v) => patch(a, { notifyOnWhatsApp: v })} label="WhatsApp alerts" />
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-app mt-auto pt-3">
                <a className="btn btn-sm" href={`/inbox?accountId=${a.id}`}>📥 Inbox</a>
                <button className="btn btn-sm" onClick={() => setEditing({ id: a.id, form: { ...blank, ...a, password: "" } })}>✏️ Edit</button>
                {!a.isDefault && <button className="btn btn-sm" onClick={() => patch(a, { isDefault: true })}>⭐ Make default</button>}
                <button className="btn btn-sm btn-danger ml-auto" onClick={() => remove(a)}>🗑 Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <AccountForm initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </>
  );
}

function AccountForm({ initial, onClose, onSaved }: { initial: { id?: string; form: Form }; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Form>(initial.form);
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);
  const [advanced, setAdvanced] = useState(!!initial.id || initial.form.preset === "custom");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const preset = MAIL_PRESETS.find((p) => p.id === f.preset) ?? MAIL_PRESETS[MAIL_PRESETS.length - 1];

  const applyPreset = (id: string) => {
    const p = MAIL_PRESETS.find((x) => x.id === id)!;
    setF((x) => ({ ...x, preset: id, imapHost: p.imapHost, imapPort: p.imapPort, imapSecure: p.imapSecure, smtpHost: p.smtpHost, smtpPort: p.smtpPort, smtpSecure: p.smtpSecure, appendSent: p.appendSent }));
    if (id === "custom") setAdvanced(true);
  };
  const onAddress = (v: string) => setF((x) => ({ ...x, address: v, username: !x.username || x.username === x.address ? v : x.username, label: x.label || "" }));

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    try {
      setTest(await api<TestResult>("/api/accounts/test", { body: { ...f, id: initial.id } }));
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setTesting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, label: f.label || f.address.split("@")[0], ...(initial.id && !f.password ? { password: undefined } : {}) };
      if (initial.id) await api(`/api/accounts/${initial.id}`, { method: "PATCH", body });
      else await api("/api/accounts", { body });
      toast("success", initial.id ? "Account updated" : "Account added – connecting in a few seconds");
      onSaved();
    } catch (err) {
      toast("error", (err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={initial.id ? "Edit email account" : "Add email account"} wide>
      <form onSubmit={save} className="space-y-4">
        <Field label="Provider">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MAIL_PRESETS.map((p) => (
              <button type="button" key={p.id} onClick={() => applyPreset(p.id)} className={`btn btn-sm justify-start ${f.preset === p.id ? "ring-2 ring-green-600" : ""}`}>{p.name}</button>
            ))}
          </div>
        </Field>
        <div className="text-xs rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-3">💡 {preset.help}</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Email address"><input className="input" type="email" required value={f.address} onChange={(e) => onAddress(e.target.value)} /></Field>
          <Field label="Label" hint="Short name shown in WhatsApp, e.g. Work"><input className="input" placeholder={f.address.split("@")[0] || "Work"} value={f.label} onChange={(e) => set("label", e.target.value)} /></Field>
          <Field label="Sender name" hint="Shown to recipients"><input className="input" value={f.displayName} onChange={(e) => set("displayName", e.target.value)} /></Field>
          <Field label={initial.id ? "Password (leave blank to keep)" : "Password / App password"}>
            <input className="input" type="password" autoComplete="new-password" required={!initial.id} value={f.password} onChange={(e) => set("password", e.target.value)} />
          </Field>
        </div>

        <button type="button" className="text-sm text-green-700 dark:text-green-400" onClick={() => setAdvanced(!advanced)}>{advanced ? "▾" : "▸"} Server settings</button>
        {advanced && (
          <div className="grid sm:grid-cols-2 gap-3 panel p-3">
            <Field label="Username"><input className="input" required value={f.username} onChange={(e) => set("username", e.target.value)} /></Field>
            <div />
            <Field label="IMAP host"><input className="input" required value={f.imapHost} onChange={(e) => set("imapHost", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Field label="IMAP port"><input className="input" type="number" value={f.imapPort} onChange={(e) => set("imapPort", Number(e.target.value))} /></Field>
              <div className="pb-2"><Toggle checked={f.imapSecure} onChange={(v) => set("imapSecure", v)} label="SSL/TLS" /></div>
            </div>
            <Field label="SMTP host"><input className="input" required value={f.smtpHost} onChange={(e) => set("smtpHost", e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-2 items-end">
              <Field label="SMTP port"><input className="input" type="number" value={f.smtpPort} onChange={(e) => set("smtpPort", Number(e.target.value))} /></Field>
              <div className="pb-2"><Toggle checked={f.smtpSecure} onChange={(v) => set("smtpSecure", v)} label="SSL/TLS" /></div>
            </div>
            <div className="sm:col-span-2"><Toggle checked={f.appendSent} onChange={(v) => set("appendSent", v)} label="Save a copy of sent emails to the Sent folder (turn off for Gmail/Outlook)" /></div>
          </div>
        )}

        <Field label="Signature" hint="Appended to every email sent from this account">
          <textarea className="input" rows={3} value={f.signature} onChange={(e) => set("signature", e.target.value)} placeholder={"Best regards,\nYour Name"} />
        </Field>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Active (watch for new mail)" />
          <Toggle checked={f.notifyOnWhatsApp} onChange={(v) => set("notifyOnWhatsApp", v)} label="Send summaries to WhatsApp" />
          <Toggle checked={f.isDefault} onChange={(v) => set("isDefault", v)} label="Default sending account" />
        </div>

        {test && (
          <div className="space-y-1 text-sm">
            <div className={test.imap.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}>{test.imap.ok ? "✅" : "❌"} IMAP (receive): {test.imap.message}</div>
            <div className={test.smtp.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}>{test.smtp.ok ? "✅" : "❌"} SMTP (send): {test.smtp.message}</div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 justify-end pt-2">
          <button type="button" className="btn" onClick={runTest} disabled={testing}>{testing && <Spinner />} Test connection</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner />} {initial.id ? "Save changes" : "Add account"}</button>
        </div>
      </form>
    </Modal>
  );
}
