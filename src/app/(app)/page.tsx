"use client";
import Link from "next/link";
import { useApi, timeAgo } from "@/lib/client";
import { Avatar, Badge, Loading, PriorityBadge, Tile } from "@/components/ui";
import { Sparkline } from "@/components/charts";
import { IconChip } from "@/components/ico";
import { Activity, ArrowRight, CheckCircle2, Circle, Hourglass, MailOpen, MessageCircle, Rocket, Sparkles, TrendingUp, Wand2 } from "lucide-react";

type Stats = {
  ownerName: string;
  accounts: number; connected: number; unread: number; inboxTotal: number; today: number; pending: number; sentToday: number; contacts: number;
  week: { date: string; value: number }[];
  ai: { name: string; model: string; source: string } | null;
  whatsapp: boolean;
  activity: { id: string; type: string; message: string; createdAt: string }[];
};
type EmailRow = { id: string; fromName: string; fromAddress: string; subject: string; summary: string | null; snippet: string; priority: string | null; isRead: boolean; receivedAt: string; account: { label: string } };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good Night" : h < 12 ? "Good Morning" : h < 17 ? "Good Day" : "Good Evening";
}

export default function Home() {
  const { data: s } = useApi<Stats>("/api/stats", { poll: 20_000 });
  const { data: recent } = useApi<{ items: EmailRow[] }>("/api/emails?box=inbox", { poll: 20_000 });
  if (!s) return <Loading />;

  const name = s.ownerName || "there";
  const weekTotal = s.week.reduce((a, b) => a + b.value, 0);
  const weekData = s.week.map((d) => ({ label: new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }), value: d.value }));
  const setup = [
    { done: s.accounts > 0, label: "Add an email account", href: "/accounts" },
    { done: !!s.ai, label: "Add a free AI key", href: "/ai" },
    { done: s.whatsapp, label: "Connect WhatsApp", href: "/settings" },
    { done: s.contacts > 0, label: "Add contacts & groups", href: "/contacts" },
  ];
  const doneCount = setup.filter((x) => x.done).length;
  const cta = !s.whatsapp
    ? { text: "Link your WhatsApp to your account.", btn: "Link", href: "/settings", art: <PhoneArt /> }
    : !s.ai
      ? { text: "Add a free AI key for smart summaries.", btn: "Add key", href: "/ai", art: <SparkArt icon={Sparkles} /> }
      : { text: "Let AI write your next email.", btn: "Compose", href: "/compose", art: <SparkArt icon={Wand2} /> };

  return (
    <div className="grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] gap-6 items-start">
      {/* ───── left: the "phone" summary column ───── */}
      <section className="space-y-4">
        <div className="flex items-start justify-between rise">
          <h1 className="text-[2rem] md:text-[2.3rem] font-bold leading-[1.1] tracking-tight">{greeting()},<br />{name}!</h1>
          <Link href="/settings" aria-label="Settings"><Avatar name={name} size={46} /></Link>
        </div>

        <Link href="/inbox?box=unread" className="block rise" style={{ animationDelay: "60ms" }}>
          <div className="text-sm font-semibold text-white/85">Unread emails</div>
          <div className="flex items-end gap-2">
            <span className="hero-number">{s.unread.toLocaleString()}</span>
            <span className="text-lg muted mb-2">/{s.inboxTotal.toLocaleString()}</span>
          </div>
        </Link>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-3">
            <Tile label="Today" icon={MailOpen} tone="sky" value={s.today} unit="received" href="/insights" />
            <Tile label="Approvals" icon={Hourglass} tone="orange" value={s.pending} unit={s.pending === 1 ? "draft waiting" : "drafts waiting"} href="/drafts" className={s.pending ? "ring-sel" : ""} />
          </div>
          <Tile label="This week" icon={TrendingUp} tone="pink" href="/insights" className="flex flex-col">
            <div className="flex-1 flex items-center py-3 min-h-[90px]"><div className="w-full"><Sparkline data={weekData} height={74} unit=" emails" /></div></div>
            <div className="tile-number">{weekTotal}</div>
            <div className="text-xs muted mt-1">emails · {s.sentToday} sent today</div>
          </Tile>
        </div>

        <div className="glass p-4 flex items-center gap-3 rise" style={{ animationDelay: "160ms" }}>
          <div className="flex-1">
            <p className="font-semibold leading-snug">{cta.text}</p>
            <Link href={cta.href} className="btn btn-primary btn-sm mt-3">{cta.btn}</Link>
          </div>
          {cta.art}
        </div>
      </section>

      {/* ───── right: details ───── */}
      <section className="space-y-5">
        {doneCount < setup.length && (
          <div className="glass p-5 rise">
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold flex items-center gap-2.5"><IconChip icon={Rocket} tone="orange" size={30} /> Finish setting up</div>
              <span className="text-xs muted">{doneCount}/{setup.length} done</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/15 mb-4 overflow-hidden"><div className="h-full rounded-full bg-white" style={{ width: `${(doneCount / setup.length) * 100}%` }} /></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {setup.map((x) => x.done ? (
                <div key={x.label} className="glass-soft px-3 py-2.5 text-sm muted line-through flex items-center gap-2"><CheckCircle2 size={16} className="text-emerald-300 shrink-0" /> {x.label}</div>
              ) : (
                <Link key={x.label} href={x.href} className="glass-soft lift px-3 py-2.5 text-sm font-semibold flex items-center gap-2"><Circle size={16} className="shrink-0 opacity-70" /> <span className="flex-1">{x.label}</span><ArrowRight size={16} /></Link>
              ))}
            </div>
          </div>
        )}

        <div className="glass rise overflow-hidden">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <h2 className="font-bold text-lg">Latest emails</h2>
            <Link href="/inbox" className="btn btn-sm">View all</Link>
          </div>
          {!recent?.items.length && <p className="px-5 pb-5 text-sm muted">No emails yet. They appear here as soon as an account is connected.</p>}
          <div className="divide-app">
            {recent?.items.slice(0, 6).map((e) => (
              <Link key={e.id} href={`/inbox/${e.id}`} className="flex gap-3 px-5 py-3.5 hover-tint">
                <Avatar name={e.fromName || e.fromAddress} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`truncate text-sm ${e.isRead ? "text-white/85" : "font-bold"}`}>{e.fromName || e.fromAddress}</span>
                    <PriorityBadge p={e.priority} />
                    <span className="ml-auto text-xs faint shrink-0">{timeAgo(e.receivedAt)}</span>
                  </div>
                  <div className={`text-sm truncate ${e.isRead ? "muted" : "font-semibold"}`}>{e.subject}</div>
                  <div className="text-xs faint line-clamp-1">{e.summary ?? e.snippet}</div>
                </div>
                {!e.isRead && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-[#ff7a45] shrink-0 shadow-[0_0_10px_#ff7a45]" aria-label="unread" />}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <div className="glass p-5 space-y-3 rise">
            <h2 className="font-bold flex items-center gap-2.5"><IconChip icon={Activity} tone="green" size={30} /> System status</h2>
            <Row label="Email accounts" value={<Badge color={s.accounts && s.connected === s.accounts ? "green" : s.accounts ? "amber" : "gray"}>{s.connected}/{s.accounts} connected</Badge>} />
            <Row label="AI" value={s.ai ? <Badge color="green">{s.ai.model}</Badge> : <Badge color="red">Not set</Badge>} />
            <Row label="WhatsApp" value={s.whatsapp ? <Badge color="green">Connected</Badge> : <Badge color="red">Not set</Badge>} />
            <Row label="Contacts" value={<Badge>{s.contacts}</Badge>} />
          </div>
          <div className="glass p-5 rise">
            <h2 className="font-bold mb-3 flex items-center gap-2.5"><IconChip icon={MessageCircle} tone="violet" size={30} /> Activity</h2>
            {!s.activity.length && <p className="text-sm muted">Nothing yet.</p>}
            <ul className="space-y-2.5">
              {s.activity.slice(0, 6).map((a) => (
                <li key={a.id} className="text-xs flex gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${a.type === "error" ? "bg-rose-300" : "bg-white/70"}`} />
                  <span><span className={a.type === "error" ? "text-bad" : "text-white/90"}>{a.message}</span><span className="faint"> · {timeAgo(a.createdAt)}</span></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-2 text-sm"><span className="muted">{label}</span>{value}</div>;
}

function PhoneArt() {
  return <IconChip icon={MessageCircle} tone="green" size={72} float className="shrink-0" />;
}

function SparkArt({ icon }: { icon: typeof Sparkles }) {
  return <IconChip icon={icon} tone="pink" size={72} float className="shrink-0" />;
}
