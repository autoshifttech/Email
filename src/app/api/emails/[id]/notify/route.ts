import { NextResponse } from "next/server";
import { handle, type Ctx } from "@/lib/api";
import { notifyEmail } from "@/lib/notify";

/** Manually forward an email summary to WhatsApp. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  return NextResponse.json(await notifyEmail(id, { force: true }));
});
