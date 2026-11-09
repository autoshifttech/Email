import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type EmailFilter = { accountId?: string; box?: string; q?: string; page?: number; pageSize?: number };

export async function queryEmails(f: EmailFilter) {
  const where: Prisma.EmailWhereInput = {};
  if (f.accountId) where.accountId = f.accountId;
  switch (f.box) {
    case "sent": where.direction = "OUT"; break;
    case "archived": where.direction = "IN"; where.isArchived = true; break;
    case "unread": where.direction = "IN"; where.isArchived = false; where.isRead = false; break;
    case "important": where.direction = "IN"; where.isArchived = false; where.priority = { in: ["high", "urgent"] }; break;
    default: where.direction = "IN"; where.isArchived = false;
  }
  if (f.q) {
    where.OR = [
      { subject: { contains: f.q, mode: "insensitive" } },
      { fromAddress: { contains: f.q, mode: "insensitive" } },
      { fromName: { contains: f.q, mode: "insensitive" } },
      { to: { contains: f.q, mode: "insensitive" } },
      { text: { contains: f.q, mode: "insensitive" } },
    ];
  }
  const pageSize = Math.min(f.pageSize ?? 30, 100);
  const page = Math.max(1, f.page ?? 1);
  const [total, items] = await Promise.all([
    prisma.email.count({ where }),
    prisma.email.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, accountId: true, direction: true, fromName: true, fromAddress: true, to: true, subject: true,
        snippet: true, summary: true, priority: true, category: true, isRead: true, isArchived: true, receivedAt: true,
        notifiedAt: true, account: { select: { label: true, address: true } },
      },
    }),
  ]);
  return { total, page, pageSize, items };
}
