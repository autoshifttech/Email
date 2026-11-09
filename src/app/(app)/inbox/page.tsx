"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi, timeAgo } from "@/lib/client";
import { Badge, Empty, Loading, PageHeader, PriorityBadge } from "@/components/ui";

type Row = {
  id: string; direction: string; fromName: string; fromAddress: string; to: string; subject: string; snippet: string; summary: string | null;
  priority: string | null; category: string | null; isRead: boolean; receivedAt: string; notifiedAt: string | null; account: { label: string };
};
type List = { total: number; page: number; pageSize: number; items: Row[] };
type Account = { id: string; label: string; unread: number };

const BOXES = [
  { id: "inbox", label: "Inbox" },
  { id: "unread", label: "Unread" },
  { id: "important", label: "Important" },
  { id: "sent", label: "Sent" },
  { id: "archived", label: "Archived" },
];

export default function InboxPage() {
  return <Suspense fallback={<Loading />}><Inbox /></Suspense>;
}

function Inbox() {
  const router = useRouter();
  const sp = useSearchParams();
  const box = sp.get("box") ?? "inbox";
  const accountId = sp.get("accountId") ?? "";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const { data: accounts } = useApi<Account[]>("/api/accounts");
  const qs = new URLSearchParams({ box, ...(accountId ? { accountId } : {}), ...(sp.get("q") ? { q: sp.get("q")! } : {}), page: String(page) });
  const { data, loading } = useApi<List>(`/api/emails?${qs}`, { poll: 15_000 });

  const nav = (patch: Record<string, string>) => {
    const n = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) (v ? n.set(k, v) : n.delete(k));
    if (!("page" in patch)) n.delete("page");
    router.push(`/inbox?${n}`);
  };
  useEffect(() => {
    const t = setTimeout(() => q !== (sp.get("q") ?? "") && nav({ q }), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <PageHeader title="Inbox" subtitle={data ? `${data.total} email${data.total === 1 ? "" : "s"}` : undefined} actions={<Link href="/compose" className="btn btn-primary">✏️ Compose</Link>} />
      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <input className="input md:max-w-xs" placeholder="🔍 Search emails…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input md:max-w-[220px]" value={accountId} onChange={(e) => nav({ accountId: e.target.value })}>
          <option value="">All accounts</option>
          {accounts?.map((a) => <option key={a.id} value={a.id}>{a.label}{a.unread ? ` (${a.unread})` : ""}</option>)}
        </select>
      </div>
      <div className="flex gap-1 overflow-x-auto mb-4 -mx-1 px-1">
        {BOXES.map((b) => (
          <button key={b.id} onClick={() => nav({ box: b.id === "inbox" ? "" : b.id })} className={`btn btn-sm ${box === b.id ? "btn-primary" : ""}`}>{b.label}</button>
        ))}
      </div>

      {loading && !data ? <Loading /> : !data?.items.length ? (
        <Empty icon="📭" title="Nothing here" text={box === "inbox" ? "New emails show up automatically once an account is connected." : undefined} />
      ) : (
        <div className="panel overflow-hidden">
          {data.items.map((e) => (
            <Link key={e.id} href={`/inbox/${e.id}`} className="block px-4 py-3 border-b border-app last:border-0 hover:bg-black/[.03] dark:hover:bg-white/[.03]">
              <div className="flex items-center gap-2 min-w-0">
                {!e.isRead && <span className="h-2 w-2 rounded-full bg-green-600 shrink-0" />}
                <span className={`truncate ${e.isRead ? "" : "font-semibold"}`}>{e.direction === "OUT" ? `To: ${e.to}` : e.fromName || e.fromAddress}</span>
                <span className="hidden sm:inline"><Badge>{e.account.label}</Badge></span>
                <PriorityBadge p={e.priority} />
                {e.notifiedAt && <span title="Sent to WhatsApp" className="text-xs">💬</span>}
                <span className="ml-auto text-xs muted shrink-0">{timeAgo(e.receivedAt)}</span>
              </div>
              <div className={`text-sm truncate ${e.isRead ? "" : "font-medium"}`}>{e.subject}</div>
              <div className="text-xs muted line-clamp-2">{e.summary ? `🤖 ${e.summary}` : e.snippet}</div>
            </Link>
          ))}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => nav({ page: String(page - 1) })}>← Prev</button>
          <span className="muted">Page {page} / {pages}</span>
          <button className="btn btn-sm" disabled={page >= pages} onClick={() => nav({ page: String(page + 1) })}>Next →</button>
        </div>
      )}
    </>
  );
}
