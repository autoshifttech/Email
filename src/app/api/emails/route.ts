import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { queryEmails } from "@/lib/email-query";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url).searchParams;
  return NextResponse.json(
    await queryEmails({
      accountId: u.get("accountId") || undefined,
      box: u.get("box") || undefined,
      q: u.get("q") || undefined,
      page: Number(u.get("page") || 1),
    }),
  );
});
