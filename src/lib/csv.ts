import { isEmail } from "./recipients";

/** Parse "name,email[,tags]" or "email" lines (CSV paste). A header row is skipped automatically. */
export function parseContactsCsv(csv: string) {
  const rows: { name: string; email: string; tags: string }[] = [];
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cells = line.split(/[,;\t]/).map((c) => c.trim().replace(/^"|"$/g, ""));
    const emailIdx = cells.findIndex((c) => isEmail(c));
    if (emailIdx === -1) continue;
    const email = cells[emailIdx].toLowerCase();
    const others = cells.filter((_, i) => i !== emailIdx);
    rows.push({ email, name: others[0] ?? "", tags: others.slice(1).join(" ") });
  }
  return rows;
}
