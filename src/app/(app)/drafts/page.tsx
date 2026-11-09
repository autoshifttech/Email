"use client";
import { useState } from "react";
import { api, useApi, timeAgo } from "@/lib/client";
import { Badge, Empty, Loading, PageHeader, Spinner, StatusBadge } from "@/components/ui";
import { useToast } from "@/components/toast";

type Draft = {
  id: string; mode: string; recipients: string; subject: string; body: string; prompt: string | null; author: string; origin: string;
  status: string; sentCount: number; error: string | null; createdAt: string; sentAt: string | null;
  account: { label: string; address: string }; replyToEmail: { subject: string; fromAddress: string } | null;
};

const TABS = [
  { id: "PENDING_APPROVAL", label: "Awaiting approval" },
  { id: "SENT", label: "Sent" },
  { id: "FAILED", label: "Failed" },
  { id: "REJECTED", label: "Cancelled" },
  { id: "", label: "All" },
];

export default function DraftsPage() {
  const [tab, setTab] = useState("PENDING_APPROVAL");
  const { data, loading, reload } = useApi<Draft[]>(`/api/drafts?status=${tab}`, { poll: 5000 });
  return (
    <>
      <PageHeader title="Approvals" subtitle="Drafts from WhatsApp and the dashboard. Nothing is sent until you approve it." />
      <div className="flex gap-1 overflow-x-auto mb-4">
        {TABS.map((t) => <button key={t.id} onClick={() => setTab(t.id)} className={`btn btn-sm ${tab === t.id ? "btn-primary" : ""}`}>{t.label}</button>)}
      </div>
      {loading && !data ? <Loading /> : !data?.length ? (
        <Empty icon="✅" title={tab === "PENDING_APPROVAL" ? "Nothing waiting for approval" : "No drafts"} text="AI drafts you request on WhatsApp also appear here." />
      ) : (
        <div className="space-y-4">{data.map((d) => <DraftCard key={d.id} d={d} onChange={reload} />)}</div>
      )}
    </>
  );
}

function DraftCard({ d, onChange }: { d: Draft; onChange: () => void }) {
  const toast = useToast();
  const recipients: string[] = JSON.parse(d.recipients || "[]");
  const [edit, setEdit] = useState(false);
  const [subject, setSubject] = useState(d.subject);
  const [body, setBody] = useState(d.body);
  const [to, setTo] = useState(recipients.join(", "));
  const [aiPrompt, setAiPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const editable = d.status === "PENDING_APPROVAL" || d.status === "FAILED";

  const run = async (name: string, fn: () => Promise<unknown>, ok?: string) => {
    setBusy(name);
    try {
      await fn();
      if (ok) toast("success", ok);
      onChange();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const save = () => run("save", async () => {
    await api(`/api/drafts/${d.id}`, { method: "PATCH", body: { subject, body, ...(d.mode !== "BROADCAST" ? { to } : {}) } });
    setEdit(false);
  }, "Draft saved");
  const revise = () => run("ai", async () => {
    const r = await api<{ subject: string; body: string }>("/api/ai/draft", { body: { kind: "revise", subject, body, prompt: aiPrompt } });
    setSubject(r.subject);
    setBody(r.body);
    setEdit(true);
    setAiPrompt("");
  });
  const send = () => run("send", async () => {
    if (edit) await api(`/api/drafts/${d.id}`, { method: "PATCH", body: { subject, body, ...(d.mode !== "BROADCAST" ? { to } : {}) } });
    if (recipients.length > 1 && !confirm(`Send to ${recipients.length} recipients?`)) return;
    const r = await api<{ queued?: boolean }>(`/api/drafts/${d.id}/send`, { method: "POST" });
    toast("success", r.queued ? "Sending in the background…" : "Sent ✅");
  });

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <StatusBadge s={d.status} />
        <Badge color="blue">{d.mode === "REPLY" ? "Reply" : d.mode === "BROADCAST" ? `Broadcast · ${recipients.length}` : "New email"}</Badge>
        <Badge color={d.author === "AI" ? "purple" : "gray"}>{d.author === "AI" ? "🤖 AI" : "✍️ Manual"}</Badge>
        <Badge>{d.origin === "WHATSAPP" ? "💬 WhatsApp" : "🖥 Dashboard"}</Badge>
        <span className="ml-auto text-xs muted">{timeAgo(d.createdAt)}</span>
      </div>
      <div className="text-sm space-y-0.5 mb-3">
        <div><span className="muted">From:</span> {d.account.label} ({d.account.address})</div>
        {edit && d.mode !== "BROADCAST" ? (
          <input className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
        ) : (
          <div className="truncate"><span className="muted">To:</span> {recipients.length > 5 ? `${recipients.slice(0, 5).join(", ")} +${recipients.length - 5} more` : recipients.join(", ")}</div>
        )}
        {d.replyToEmail && <div className="muted text-xs">Re: “{d.replyToEmail.subject}” from {d.replyToEmail.fromAddress}</div>}
        {d.prompt && <div className="muted text-xs">Prompt: “{d.prompt}”</div>}
      </div>
      {edit ? (
        <div className="space-y-2">
          <input className="input font-semibold" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="input" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
      ) : (
        <div className="rounded-xl glass-soft p-4">
          <div className="font-semibold mb-2">{subject}</div>
          <div className="prose-email">{body}</div>
        </div>
      )}
      {d.status === "SENDING" && <p className="text-sm mt-2"><Spinner /> Sent {d.sentCount}/{recipients.length}…</p>}
      {d.status === "SENT" && <p className="text-sm mt-2 text-accent font-semibold">✅ Sent to {d.sentCount} recipient(s) {d.sentAt && timeAgo(d.sentAt)}</p>}
      {d.error && <pre className="text-xs text-bad mt-2 whitespace-pre-wrap">{d.error}</pre>}
      {editable && (
        <>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <input className="input" placeholder='🤖 Ask AI to change it, e.g. "make it shorter"' value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && aiPrompt && revise()} />
            <button className="btn" disabled={!aiPrompt || busy === "ai"} onClick={revise}>{busy === "ai" && <Spinner />} Revise</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 justify-end">
            {edit ? <button className="btn" onClick={save} disabled={!!busy}>{busy === "save" && <Spinner />} Save</button> : <button className="btn" onClick={() => setEdit(true)}>✏️ Edit</button>}
            <button className="btn btn-danger" disabled={!!busy} onClick={() => run("rej", () => api(`/api/drafts/${d.id}`, { method: "PATCH", body: { status: "REJECTED" } }), "Draft cancelled")}>❌ Reject</button>
            <button className="btn btn-primary" disabled={!!busy} onClick={send}>{busy === "send" && <Spinner />} ✅ Approve & send</button>
          </div>
        </>
      )}
      {!editable && d.status !== "SENDING" && (
        <div className="flex justify-end mt-3">
          <button className="btn btn-sm btn-danger" onClick={() => confirm("Delete this draft record?") && run("del", () => api(`/api/drafts/${d.id}`, { method: "DELETE" }), "Deleted")}>🗑 Delete</button>
        </div>
      )}
    </div>
  );
}
