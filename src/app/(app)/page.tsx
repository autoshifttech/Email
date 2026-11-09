"use client";
import Link from "next/link";
import { useApi, timeAgo } from "@/lib/client";
import { Badge, Loading, PageHeader, PriorityBadge } from "@/components/ui";

type Stats = {
  accounts: number; connected: number; unread: number; today: number; pending: number; sentToday: number; contacts: number;
  ai: { name: string; model: string; source: string } | null;
  whatsapp: boolean;
  activity: { id: string; type: string; message: string; createdAt: string }[];
};
type EmailRow = { id: string; fromName: string; fromAddress: string; subject: string; summary: string | null; snippet: string; priority: string | null; isRead: boolean; receivedAt: string; account: { label: string } };

export default function Overview() {
  const { data: s } = useApi<Stats>("/api/stats", { poll: 20_000 });
  const { data: recent } = useApi<{ items: EmailRow[] }>("/api/emails?box=inbox", { poll: 20_000 });
  if (!s) return <Loading />;

  const setup = [
    { done: s.accounts > 0, label: "Add an email account", href: "/accounts" },
    { done: !!s.ai, label: "Add a free AI API key (Groq or Gemini)", href: "/ai" },
    { done: s.whatsapp, label: "Connect WhatsApp", href: "/settings" },
    { done: s.contacts > 0, label: "Add contacts / groups (for broadcast emails)", href: "/contacts" },
  ];
  const todo = setup.filter((x) => !x.done);

  return (
    <>
      <PageHeader title="Overview" subtitle="Everything happening across your inboxes" actions={<Link href="/compose" className="btn btn-primary">✏️ Compose</Link>} />

      {todo.length > 0 && (
        <div className="panel p-5 mb-5 border-green-300 dark:border-green-800">
          <div className="font-semibold mb-2">🚀 Finish setting up MailBridge</div>
          <ul className="space-y-1.5">
            {setup.map((x) => (
              <li key={x.label} className="text-sm flex items-center gap-2">
                <span>{x.done ? "✅" : "⬜"}</span>
                {x.done ? <span className="muted line-through">{x.label}</span> : <Link className="text-green-700 dark:text-green-400 font-medium hover:underline" href={x.href}>{x.label} →</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Unread" value={s.unread} href="/inbox?box=unread" />
        <Stat label="Received (24h)" value={s.today} href="/inbox" />
        <Stat label="Awaiting approval" value={s.pending} href="/drafts" highlight={s.pending > 0} />
        <Stat label="Sent (24h)" value={s.sentToday} href="/inbox?box=sent" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 panel">
          <div className="flex items-center justify-between p-4 border-b border-app">
            <h2 className="font-semibold">Latest emails</h2>
            <Link href="/inbox" className="text-sm text-green-700 dark:text-green-400">View all →</Link>
          </div>
          {!recent?.items.length && <p className="p-6 text-sm muted">No emails yet. They appear here as soon as an account is connected.</p>}
          {recent?.items.slice(0, 8).map((e) => (
            <Link key={e.id} href={`/inbox/${e.id}`} className="block px-4 py-3 border-b border-app last:border-0 hover:bg-black/[.03] dark:hover:bg-white/[.03]">
              <div className="flex items-center gap-2">
                {!e.isRead && <span className="h-2 w-2 rounded-full bg-green-600 shrink-0" />}
                <span className={`truncate text-sm ${e.isRead ? "" : "font-semibold"}`}>{e.fromName || e.fromAddress}</span>
                <PriorityBadge p={e.priority} />
                <span className="ml-auto text-xs muted shrink-0">{timeAgo(e.receivedAt)}</span>
              </div>
              <div className="text-sm truncate">{e.subject}</div>
              <div className="text-xs muted line-clamp-1">{e.summary ?? e.snippet}</div>
            </Link>
          ))}
        </div>

        <div className="space-y-5">
          <div className="panel p-4 space-y-3">
            <h2 className="font-semibold">System status</h2>
            <Row label="Email accounts" value={<Badge color={s.accounts && s.connected === s.accounts ? "green" : s.accounts ? "amber" : "gray"}>{s.connected}/{s.accounts} connected</Badge>} />
            <Row label="AI" value={s.ai ? <Badge color="green">{s.ai.model}</Badge> : <Badge color="red">Not set</Badge>} />
            <Row label="WhatsApp" value={s.whatsapp ? <Badge color="green">Connected</Badge> : <Badge color="red">Not set</Badge>} />
            <Row label="Contacts" value={<Badge>{s.contacts}</Badge>} />
          </div>
          <div className="panel p-4">
            <h2 className="font-semibold mb-3">Activity</h2>
            {!s.activity.length && <p className="text-sm muted">Nothing yet.</p>}
            <ul className="space-y-2">
              {s.activity.map((a) => (
                <li key={a.id} className="text-xs">
                  <span className={a.type === "error" ? "text-red-600" : ""}>{a.message}</span>
                  <span className="muted"> · {timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, href, highlight }: { label: string; value: number; href: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`panel p-4 hover:shadow-sm ${highlight ? "ring-2 ring-amber-400" : ""}`}>
      <div className="text-xs muted font-medium uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-1 tabular-nums">{value}</div>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between text-sm"><span className="muted">{label}</span>{value}</div>;
}
