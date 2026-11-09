import { prisma } from "./db";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const isEmail = (s: string) => EMAIL_RE.test(s.trim());

export function splitAddresses(s: string): string[] {
  return s
    .split(/[,;\s]+/)
    .map((x) => x.trim().replace(/^<|>$/g, "").toLowerCase())
    .filter(Boolean);
}

export type Resolved = { emails: string[]; groupId?: string; label: string; unknown: string[] };

/**
 * Resolve a target to email addresses:
 *  - "all" / "everyone"         -> every contact
 *  - a group name                -> that group's members
 *  - email(s), comma separated   -> as given
 *  - a contact name              -> that contact
 */
export async function resolveTarget(target: string): Promise<Resolved> {
  const t = target.trim();
  if (/^(all|everyone|all contacts)$/i.test(t)) {
    const contacts = await prisma.contact.findMany({ select: { email: true } });
    return { emails: contacts.map((c) => c.email), label: `all contacts (${contacts.length})`, unknown: [] };
  }
  const group = await prisma.group.findFirst({
    where: { name: t },
    include: { members: { include: { contact: true } } },
  }) ?? (await prisma.group.findMany({ include: { members: { include: { contact: true } } } })).find(
    (g) => g.name.toLowerCase() === t.toLowerCase(),
  );
  if (group) {
    return {
      emails: group.members.map((m) => m.contact.email),
      groupId: group.id,
      label: `group "${group.name}" (${group.members.length})`,
      unknown: [],
    };
  }
  const parts = t.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  const emails: string[] = [];
  const unknown: string[] = [];
  const contacts = await prisma.contact.findMany();
  for (const p of parts) {
    const clean = p.replace(/^<|>$/g, "").toLowerCase();
    if (isEmail(clean)) emails.push(clean);
    else {
      const c = contacts.find((c) => c.name.toLowerCase() === p.toLowerCase());
      if (c) emails.push(c.email);
      else unknown.push(p);
    }
  }
  const uniq = [...new Set(emails)];
  return { emails: uniq, label: uniq.join(", "), unknown };
}

/** Replace {{name}} with the contact's name (or a friendly fallback). */
export function personalize(body: string, name: string | null | undefined): string {
  const first = (name || "").trim().split(/\s+/)[0];
  return body.replace(/\{\{\s*name\s*\}\}/gi, first || "there");
}
