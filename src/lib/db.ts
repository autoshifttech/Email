import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = g.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function logActivity(type: string, message: string) {
  try {
    await prisma.activityLog.create({ data: { type, message: message.slice(0, 500) } });
  } catch {
    /* logging must never break a flow */
  }
}
