"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client";
import { Field, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";

type Account = { id: string; label: string; address: string; isDefault: boolean; isActive: boolean };
type Group = { id: string; name: string; memberCount: number };

export default function ComposePage() {
  const router = useRouter();
  const toast = useToast();
  const { data: accounts } = useApi<Account[]>("/api/accounts");
  const { data: groups } = useApi<Group[]>("/api/groups");
  const { data: contacts } = useApi<{ id: string }[]>("/api/contacts");
  const [accountId, setAccountId] = useState("");
  const [target, setTarget] = useState<"emails" | "group" | "all">("emails");
  const [to, setTo] = useState("");
  const [groupId, setGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [prompt, setPrompt] = useState("");
  const [author, setAuthor] = useState<"AI" | "MANUAL">("MANUAL");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (accounts?.length && !accountId) setAccountId((accounts.find((a) => a.isDefault) ?? accounts[0]).id);
  }, [accounts, accountId]);
  useEffect(() => {
    if (groups?.length && !groupId) setGroupId(groups[0].id);
  }, [groups, groupId]);

  const broadcast = target !== "emails";
  const recipientCount = target === "all" ? contacts?.length ?? 0 : target === "group" ? groups?.find((g) => g.id === groupId)?.memberCount ?? 0 : to.split(/[,;\s]+/).filter(Boolean).length;

  const generate = async () => {
    if (!prompt.trim()) return toast("error", "Tell the AI what to write first");
    setBusy("ai");
    try {
      const r = body && author === "AI"
        ? await api<{ subject: string; body: string }>("/api/ai/draft", { body: { kind: "revise", subject, body, prompt } })
        : await api<{ subject: string; body: string }>("/api/ai/draft", { body: { kind: "new", prompt, subject: subject || undefined, broadcast } });
      setSubject(r.subject);
      setBody(r.body);
      setAuthor("AI");
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async (sendNow: boolean) => {
    if (sendNow && broadcast && !confirm(`Send this email individually to ${recipientCount} recipients?`)) return;
    setBusy(sendNow ? "send" : "save");
    try {
      const r = await api<{ queued?: boolean }>("/api/drafts", { body: { accountId, target, to, groupId: target === "group" ? groupId : undefined, subject, body, prompt: prompt || undefined, author, sendNow } });
      toast("success", !sendNow ? "Saved to Approvals" : r.queued ? `Sending to ${recipientCount} recipients in the background…` : "Email sent ✅");
      router.push(sendNow && !r.queued ? "/inbox?box=sent" : "/drafts");
    } catch (e) {
      toast("error", (e as Error).message);
      setBusy(null);
    }
  };

  if (accounts && !accounts.length) {
    return (
      <>
        <PageHeader title="Compose" />
        <div className="glass p-6 text-sm">Add an email account first. <a className="text-accent font-semibold font-medium" href="/accounts">Go to Email Accounts →</a></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Compose" subtitle="Write a new email yourself or let AI write it, to one person, a group or everyone" />
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 glass p-5 space-y-4">
          <Field label="From">
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              {accounts?.map((a) => <option key={a.id} value={a.id}>{a.label} – {a.address}{a.isActive ? "" : " (disabled)"}</option>)}
            </select>
          </Field>
          <Field label="Send to">
            <div className="flex gap-2 mb-2">
              {(["emails", "group", "all"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setTarget(t)} className={`btn btn-sm ${target === t ? "btn-primary" : ""}`}>
                  {t === "emails" ? "Email addresses" : t === "group" ? "A group" : `Everyone (${contacts?.length ?? 0})`}
                </button>
              ))}
            </div>
            {target === "emails" && <input className="input" placeholder="name@example.com, other@example.com" value={to} onChange={(e) => setTo(e.target.value)} />}
            {target === "group" && (
              groups?.length ? (
                <select className="input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name} ({g.memberCount} members)</option>)}
                </select>
              ) : <p className="text-sm muted">No groups yet. <a className="text-accent font-semibold" href="/contacts">Create one →</a></p>
            )}
            {broadcast && <p className="text-xs muted mt-1">Each recipient gets their own email (nobody sees the others). Use <code>{"{{name}}"}</code> to insert the contact&apos;s first name.</p>}
          </Field>
          <Field label="Subject"><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Leave empty to let AI write one" /></Field>
          <Field label="Message"><textarea className="input" rows={14} value={body} onChange={(e) => { setBody(e.target.value); }} placeholder="Write your email here, or describe it to the AI →" /></Field>
          <div className="flex flex-wrap gap-2 justify-end">
            <button className="btn" disabled={!subject || !body || !!busy} onClick={() => submit(false)}>{busy === "save" && <Spinner />} Save for approval</button>
            <button className="btn btn-primary" disabled={!subject || !body || !!busy || !recipientCount} onClick={() => submit(true)}>{busy === "send" && <Spinner />} Send {recipientCount > 1 ? `to ${recipientCount}` : "now"}</button>
          </div>
        </div>
        <div className="glass p-5 h-fit space-y-3 lg:sticky lg:top-6">
          <h2 className="font-semibold">✨ Write with AI</h2>
          <p className="text-xs muted">Describe the email. The AI writes the subject and the message. You can edit everything before sending.</p>
          <textarea className="input" rows={6} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder={'e.g. "Invite the team to the product launch on 20 Nov at 5pm in the main hall, ask them to confirm by Friday"'} />
          <button className="btn btn-primary w-full" onClick={generate} disabled={busy === "ai"}>{busy === "ai" && <Spinner />} {body && author === "AI" ? "Revise draft" : "Generate email"}</button>
          {body && author === "AI" && <p className="text-xs muted">To revise, describe the changes (&quot;shorter&quot;, &quot;more formal&quot;…) and click Revise.</p>}
        </div>
      </div>
    </>
  );
}
