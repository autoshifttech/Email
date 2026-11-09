import { NextResponse } from "next/server";
import { prisma, logActivity } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { body, handle, HttpError } from "@/lib/api";
import { publicAccount } from "@/lib/serialize";
import { accountSchema } from "@/lib/schemas";

export const GET = handle(async () => {
  const accounts = await prisma.emailAccount.findMany({ orderBy: { createdAt: "asc" } });
  const counts = await prisma.email.groupBy({ by: ["accountId"], where: { isRead: false, direction: "IN", isArchived: false }, _count: true });
  const unread = new Map(counts.map((c) => [c.accountId, c._count]));
  return NextResponse.json(accounts.map((a) => ({ ...publicAccount(a), unread: unread.get(a.id) ?? 0 })));
});

export const POST = handle(async (req: Request) => {
  const d = await body(req, accountSchema);
  if (!d.password) throw new HttpError(400, "password: required");
  if (await prisma.emailAccount.findUnique({ where: { address: d.address.toLowerCase() } })) throw new HttpError(409, "This email address is already added");
  const isFirst = (await prisma.emailAccount.count()) === 0;
  const { password, ...rest } = d;
  if (d.isDefault) await prisma.emailAccount.updateMany({ data: { isDefault: false } });
  const a = await prisma.emailAccount.create({
    data: { ...rest, address: d.address.toLowerCase(), encPassword: encrypt(password), isDefault: d.isDefault || isFirst, status: d.isActive ? "pending" : "disabled" },
  });
  await logActivity("account", `Added account ${a.label} (${a.address})`);
  return NextResponse.json(publicAccount(a), { status: 201 });
});
