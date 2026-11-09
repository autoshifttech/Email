import { prisma } from "./db";
import { getAiConfig } from "./ai";
import { isWhatsAppConfigured } from "./whatsapp";

export async function getStats() {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [accounts, connected, unread, today, pending, sentToday, contacts, ai, wa, activity] = await Promise.all([
    prisma.emailAccount.count(),
    prisma.emailAccount.count({ where: { status: "connected" } }),
    prisma.email.count({ where: { direction: "IN", isRead: false, isArchived: false } }),
    prisma.email.count({ where: { direction: "IN", receivedAt: { gte: since } } }),
    prisma.draft.count({ where: { status: "PENDING_APPROVAL" } }),
    prisma.email.count({ where: { direction: "OUT", receivedAt: { gte: since } } }),
    prisma.contact.count(),
    getAiConfig(),
    isWhatsAppConfigured(),
    prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  return {
    accounts, connected, unread, today, pending, sentToday, contacts,
    ai: ai ? { name: ai.name, model: ai.model, source: ai.source } : null,
    whatsapp: wa,
    activity,
  };
}
