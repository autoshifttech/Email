import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { accountToConfig, testConnection, type MailServerConfig } from "@/lib/mail";
import { body, handle, HttpError } from "@/lib/api";

const schema = z.object({
  id: z.string().optional(),
  address: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.coerce.number().optional(),
  imapSecure: z.boolean().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.coerce.number().optional(),
  smtpSecure: z.boolean().optional(),
});

/** Test IMAP + SMTP with the submitted form values (falls back to the saved account for blanks, e.g. password). */
export const POST = handle(async (req: Request) => {
  const d = await body(req, schema);
  let base: Partial<MailServerConfig> = {};
  if (d.id) base = accountToConfig(await prisma.emailAccount.findUniqueOrThrow({ where: { id: d.id } }));
  const pick = <T,>(v: T | undefined | "", b: T | undefined) => (v === undefined || v === "" ? b : v);
  const cfg = {
    address: pick(d.address, base.address) ?? "",
    username: pick(d.username, base.username),
    password: pick(d.password, base.password),
    imapHost: pick(d.imapHost, base.imapHost),
    imapPort: pick(d.imapPort, base.imapPort) ?? 993,
    imapSecure: pick(d.imapSecure, base.imapSecure) ?? true,
    smtpHost: pick(d.smtpHost, base.smtpHost),
    smtpPort: pick(d.smtpPort, base.smtpPort) ?? 465,
    smtpSecure: pick(d.smtpSecure, base.smtpSecure) ?? true,
  };
  if (!cfg.username || !cfg.password || !cfg.imapHost || !cfg.smtpHost) throw new HttpError(400, "Fill in hosts, username and password first");
  const result = await testConnection(cfg as MailServerConfig);
  if (d.id && result.imap.ok) await prisma.emailAccount.update({ where: { id: d.id }, data: { lastError: null } });
  return NextResponse.json(result);
});
