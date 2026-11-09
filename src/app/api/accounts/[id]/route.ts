import { NextResponse } from "next/server";
import { prisma, logActivity } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { body, handle, type Ctx } from "@/lib/api";
import { publicAccount } from "@/lib/serialize";
import { accountSchema } from "@/lib/schemas";

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return NextResponse.json(publicAccount(await prisma.emailAccount.findUniqueOrThrow({ where: { id } })));
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const d = await body(req, accountSchema.partial());
  const { password, ...rest } = d;
  if (d.isDefault) await prisma.emailAccount.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
  const a = await prisma.emailAccount.update({
    where: { id },
    data: {
      ...rest,
      ...(d.address ? { address: d.address.toLowerCase() } : {}),
      ...(password ? { encPassword: encrypt(password), status: "pending", lastError: null } : {}),
      ...(d.isActive === true ? { status: "pending" } : d.isActive === false ? { status: "disabled" } : {}),
    },
  });
  return NextResponse.json(publicAccount(a));
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const a = await prisma.emailAccount.delete({ where: { id } });
  if (a.isDefault) {
    const next = await prisma.emailAccount.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) await prisma.emailAccount.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  await logActivity("account", `Deleted account ${a.label} (${a.address})`);
  return NextResponse.json({ ok: true });
});
