"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, useApi } from "@/lib/client";
import { pip, vib } from "@/lib/fx";
import { EmailRow, useBlinkingBeads, type RowEmail } from "@/components/email-row";
import { Empty, Loading } from "@/components/ui";
import { useToast, useUndo } from "@/components/toast";

type List = { total: number; page: number; pageSize: number; items: RowEmail[] };
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
  const toast = useToast();
  const showUndo = useUndo();
  const sp = useSearchParams();
  const box = sp.get("box") ?? "inbox";
  const accountId = sp.get("accountId") ?? "";
  const page = Number(sp.get("page") ?? 1);
  const [q, setQ] = useState(sp.get("q") ?? "");
  const { data: accounts } = useApi<Account[]>("/api/accounts");
  const qs = new URLSearchParams({ box, ...(accountId ? { accountId } : {}), ...(sp.get("q") ? { q: sp.get("q")! } : {}), page: String(page) });
  const { data, loading, setData, reload } = useApi<List>(`/api/emails?${qs}`, { poll: 15_000 });
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(useBlinkingBeads(listRef), []);

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
  // search: matching rows glow once the results land
  useEffect(() => {
    if (!sp.get("q")) return;
    listRef.current?.querySelectorAll(".row").forEach((r) => { r.classList.remove("hit"); void (r as HTMLElement).offsetWidth; r.classList.add("hit"); });
  }, [data, sp]);

  const patch = (id: string, body: Record<string, boolean>) => api(`/api/emails/${id}`, { method: "PATCH", body });
  const onSwipe = async (e: RowEmail, action: "read" | "archive") => {
    try {
      if (action === "read") {
        setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === e.id ? { ...x, isRead: true } : x)) } : d));
        await patch(e.id, { isRead: true });
        if (box === "unread") reload();
      } else {
        setData((d) => (d ? { ...d, total: d.total - 1, items: d.items.filter((x) => x.id !== e.id) } : d));
        await patch(e.id, { isArchived: true });
        showUndo("Archived “" + e.subject.slice(0, 28) + "”", async () => { await patch(e.id, { isArchived: false }); reload(); pip.hop(); });
      }
    } catch (err) {
      toast("error", (err as Error).message);
      reload();
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="grid gap-3 mb-3 rv">
        <div className="relative">
          <svg className="absolute left-4 top-[15px] text-[var(--ink3)] pointer-events-none" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            className="input input-pill !pl-12 !pr-12"
            type="search"
            placeholder="Search subject, sender or text"
            value={q}
            onChange={(e) => { setQ(e.target.value); pip.react("squint", "ok", 1300); }}
            aria-label="Search emails"
          />
          {q && <button type="button" className="absolute right-2 top-2 h-[34px] w-[34px] rounded-full grid place-items-center text-[var(--ink2)] bg-black/5" aria-label="Clear search" onClick={() => setQ("")}>✕</button>}
        </div>
        <div className="flex gap-2">
          <select className="input input-pill flex-1" value={accountId} onChange={(e) => nav({ accountId: e.target.value })} aria-label="Account">
            <option value="">All accounts</option>
            {accounts?.map((a) => <option key={a.id} value={a.id}>{a.label}{a.unread ? ` (${a.unread} unread)` : ""}</option>)}
          </select>
        </div>
      </div>

      <div className="chips rv" role="group" aria-label="Folders">
        {BOXES.map((b) => (
          <button key={b.id} type="button" className="chip" aria-pressed={box === b.id} onClick={() => { vib(8); nav({ box: b.id === "inbox" ? "" : b.id }); }}>
            {b.label}{box === b.id && data ? <small>{data.total}</small> : null}
          </button>
        ))}
      </div>

      <div className="sec mt-4 rv">
        <h2>{BOXES.find((b) => b.id === box)?.label} <small>{data?.total ?? ""}</small></h2>
      </div>
      {box !== "sent" && box !== "archived" && <p className="small mb-3 rv">Swipe right = Read · swipe left = Archive</p>}

      {loading && !data ? <Loading /> : !data?.items.length ? (
        <Empty icon="🤷" title={sp.get("q") ? "No matches" : "Nothing here"} text={box === "inbox" ? "New emails show up automatically once an account is connected." : undefined} />
      ) : (
        <div className="list two" ref={listRef}>
          {data.items.map((e) => <EmailRow key={e.id} e={e} onSwipe={e.direction === "IN" && box !== "archived" ? onSwipe : undefined} />)}
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-5 text-sm">
          <button className="pill" disabled={page <= 1} onClick={() => nav({ page: String(page - 1) })}>← Prev</button>
          <span className="muted">Page {page} / {pages}</span>
          <button className="pill" disabled={page >= pages} onClick={() => nav({ page: String(page + 1) })}>Next →</button>
        </div>
      )}
    </>
  );
}
