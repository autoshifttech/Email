"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, useApi } from "@/lib/client";
import { Badge, Loading, PriorityBadge, Spinner } from "@/components/ui";
import { useToast } from "@/components/toast";

type Email = {
  id: string; accountId: string; direction: string; fromName: string; fromAddress: string; to: string; cc: string; subject: string;
  text: string; html: string; summary: string | null; priority: string | null; category: string | null; isRead: boolean; isArchived: boolean;
  receivedAt: string; notifiedAt: string | null; uid: number | null; account: { label: string; address: string };
};

export default function EmailDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { data: e, reload, error } = useApi<Email>(`/api/emails/${id}`);
  const [showHtml, setShowHtml] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);

  useEffect(() => {
    if (e && !e.isRead && e.direction === "IN") api(`/api/emails/${id}`, { method: "PATCH", body: { isRead: true } }).catch(() => {});
  }, [e, id]);

  if (error) return <div className="panel p-6 text-red-600">{error}</div>;
  if (!e) return <Loading />;

  const act = async (name: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(name);
    try {
      await fn();
      toast("success", ok);
      reload();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const del = async () => {
    const server = e.uid && e.direction === "IN" ? confirm("Also delete this email from the mail server?\n\nOK = delete everywhere, Cancel = remove from MailBridge only") : false;
    if (!server && !confirm("Remove this email from MailBridge?")) return;
    await api(`/api/emails/${id}${server ? "?server=1" : ""}`, { method: "DELETE" });
    toast("success", "Email deleted");
    router.push("/inbox");
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Link href="/inbox" className="btn btn-sm">← Back</Link>
        <div className="ml-auto flex flex-wrap gap-2">
          {e.direction === "IN" && <button className="btn btn-sm btn-primary" onClick={() => setReplyOpen(true)}>↩️ Reply</button>}
          <button className="btn btn-sm" disabled={busy === "sum"} onClick={() => act("sum", () => api(`/api/emails/${id}/summarize`, { method: "POST" }), "Summary updated")}>{busy === "sum" ? <Spinner /> : "🤖"} {e.summary ? "Re-summarize" : "Summarize"}</button>
          {e.direction === "IN" && <button className="btn btn-sm" disabled={busy === "wa"} onClick={() => act("wa", async () => { const r = await api<{ sent: boolean; reason: string }>(`/api/emails/${id}/notify`, { method: "POST" }); if (!r.sent) throw new Error(r.reason); }, "Sent to WhatsApp")}>{busy === "wa" ? <Spinner /> : "💬"} Send to WhatsApp</button>}
          <button className="btn btn-sm" onClick={() => act("read", () => api(`/api/emails/${id}`, { method: "PATCH", body: { isRead: !e.isRead } }), e.isRead ? "Marked unread" : "Marked read")}>{e.isRead ? "Mark unread" : "Mark read"}</button>
          <button className="btn btn-sm" onClick={() => act("arch", () => api(`/api/emails/${id}`, { method: "PATCH", body: { isArchived: !e.isArchived } }), e.isArchived ? "Moved to inbox" : "Archived")}>{e.isArchived ? "Unarchive" : "🗄 Archive"}</button>
          <button className="btn btn-sm btn-danger" onClick={del}>🗑 Delete</button>
        </div>
      </div>

      <div className="panel p-5">
        <h1 className="text-xl font-bold mb-2">{e.subject}</h1>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge>{e.account.label}</Badge>
          <PriorityBadge p={e.priority} />
          {e.category && <Badge color="purple">{e.category}</Badge>}
          {e.notifiedAt && <Badge color="green">💬 sent to WhatsApp</Badge>}
        </div>
        <div className="text-sm space-y-0.5 mb-4">
          <div><span className="muted">From:</span> {e.fromName ? `${e.fromName} <${e.fromAddress}>` : e.fromAddress}</div>
          <div><span className="muted">To:</span> {e.to}</div>
          {e.cc && <div><span className="muted">Cc:</span> {e.cc}</div>}
          <div className="muted">{new Date(e.receivedAt).toLocaleString()}</div>
        </div>
        {e.summary && (
          <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4 mb-4 text-sm">
            <div className="font-semibold text-green-800 dark:text-green-300 mb-1">🤖 AI summary</div>
            {e.summary}
          </div>
        )}
        {e.html && (
          <div className="mb-3">
            <button className="btn btn-sm" onClick={() => setShowHtml(!showHtml)}>{showHtml ? "Show plain text" : "Show original formatting"}</button>
          </div>
        )}
        {showHtml && e.html ? (
          <iframe title="email" sandbox="" srcDoc={e.html} className="w-full min-h-[500px] rounded-lg border border-app bg-white" />
        ) : (
          <div className="prose-email">{e.text || "(empty)"}</div>
        )}
      </div>

      {replyOpen && <ReplyBox email={e} onClose={() => setReplyOpen(false)} onSent={() => { setReplyOpen(false); reload(); }} />}
    </>
  );
}

function ReplyBox({ email, onClose, onSent }: { email: Email; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState(email.subject.toLowerCase().startsWith("re:") ? email.subject : `Re: ${email.subject}`);
  const [body, setBody] = useState("");
  const [to, setTo] = useState(email.fromAddress);
  const [author, setAuthor] = useState<"AI" | "MANUAL">("MANUAL");
  const [busy, setBusy] = useState<string | null>(null);

  const generate = async () => {
    setBusy("ai");
    try {
      const r = body && author === "AI"
        ? await api<{ subject: string; body: string }>("/api/ai/draft", { body: { kind: "revise", subject, body, prompt: prompt || "improve it" } })
        : await api<{ subject: string; body: string }>("/api/ai/draft", { body: { kind: "reply", emailId: email.id, prompt } });
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
    setBusy(sendNow ? "send" : "save");
    try {
      await api("/api/drafts", { body: { accountId: email.accountId, to, replyToEmailId: email.id, subject, body, prompt: prompt || undefined, author, sendNow } });
      toast("success", sendNow ? "Reply sent ✅" : "Saved to Approvals");
      onSent();
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel p-5 mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">↩️ Reply from {email.account.address}</h2>
        <button className="btn btn-sm" onClick={onClose}>✕</button>
      </div>
      <div className="rounded-xl bg-black/[.03] dark:bg-white/[.04] p-3 space-y-2">
        <label className="label">🤖 Ask AI to write {body && author === "AI" ? "/ change" : ""} the reply</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input" placeholder='e.g. "accept the offer and ask for the contract by Friday"' value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), generate())} />
          <button className="btn" onClick={generate} disabled={busy === "ai"}>{busy === "ai" ? <Spinner /> : "✨"} {body && author === "AI" ? "Revise" : "Write with AI"}</button>
        </div>
      </div>
      <input className="input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="To" />
      <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      <textarea className="input font-[inherit]" rows={10} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your reply, or let AI draft it above…" />
      <div className="flex flex-wrap gap-2 justify-end">
        <button className="btn" disabled={!body || !!busy} onClick={() => submit(false)}>{busy === "save" && <Spinner />} Save for approval</button>
        <button className="btn btn-primary" disabled={!body || !!busy} onClick={() => submit(true)}>{busy === "send" && <Spinner />} Send now</button>
      </div>
    </div>
  );
}
