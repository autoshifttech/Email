import { prisma } from "./db";
import { getAiConfig } from "./ai";
import { isWhatsAppConfigured } from "./whatsapp";
import { getSetting } from "./settings";

const DAY = 24 * 3600 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Count received emails per day for the last `days` days (oldest first). */
export async function dailyCounts(days: number, direction = "IN") {
  const from = startOfDay(new Date(Date.now() - (days - 1) * DAY));
  const rows = await prisma.email.findMany({ where: { direction, receivedAt: { gte: from } }, select: { receivedAt: true } });
  const out = Array.from({ length: days }, (_, i) => ({ date: new Date(from.getTime() + i * DAY), value: 0 }));
  for (const r of rows) {
    const idx = Math.floor((startOfDay(r.receivedAt).getTime() - from.getTime()) / DAY);
    if (out[idx]) out[idx].value++;
  }
  return out;
}

export async function getStats() {
  const since = new Date(Date.now() - DAY);
  const [accounts, connected, unread, inboxTotal, today, pending, sentToday, contacts, ai, wa, activity, week, ownerName] = await Promise.all([
    prisma.emailAccount.count(),
    prisma.emailAccount.count({ where: { status: "connected" } }),
    prisma.email.count({ where: { direction: "IN", isRead: false, isArchived: false } }),
    prisma.email.count({ where: { direction: "IN", isArchived: false } }),
    prisma.email.count({ where: { direction: "IN", receivedAt: { gte: since } } }),
    prisma.draft.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.email.count({ where: { direction: "OUT", receivedAt: { gte: since } } }),
    prisma.contact.count(),
    getAiConfig(),
    isWhatsAppConfigured(),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    dailyCounts(7),
    getSetting("OWNER_NAME"),
  ]);
  return {
    ownerName,
    accounts, connected, unread, inboxTotal, today, pending, sentToday, contacts,
    week: week.map((d) => ({ date: d.date.toISOString(), value: d.value })),
    ai: ai ? { name: ai.name, model: ai.model, source: ai.source } : null,
    whatsapp: wa,
    activity,
  };
}

/** Per-day detail for the Insights screen. `date` is YYYY-MM-DD in the server's local time. */
export async function getInsights(date: string, tzOffsetMin = 0) {
  // Interpret the date in the viewer's timezone (offset from Date.getTimezoneOffset()).
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) + tzOffsetMin * 60_000);
  const end = new Date(start.getTime() + DAY);
  const [incoming, sentCount, aiSent, pending] = await Promise.all([
    prisma.email.findMany({ where: { direction: "IN", receivedAt: { gte: start, lt: end } }, select: { receivedAt: true, priority: true, category: true, isRead: true } }),
    prisma.email.count({ where: { direction: "OUT", receivedAt: { gte: start, lt: end } } }),
    prisma.draft.count({ where: { status: "SENT", author: "AI", sentAt: { gte: start, lt: end } } }),
    prisma.draft.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);
  const hourly = Array.from({ length: 24 }, () => 0);
  for (const e of incoming) hourly[Math.floor((e.receivedAt.getTime() - start.getTime()) / 3_600_000)]++;
  const byPriority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const e of incoming) {
    byPriority[e.priority ?? "normal"] = (byPriority[e.priority ?? "normal"] ?? 0) + 1;
    if (e.category) byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
  }
  return {
    date,
    received: incoming.length,
    unread: incoming.filter((e) => !e.isRead).length,
    important: (byPriority.high ?? 0) + (byPriority.urgent ?? 0),
    sent: sentCount,
    aiSent,
    pending,
    hourly,
    byCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
}
