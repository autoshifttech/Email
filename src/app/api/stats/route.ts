import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { getStats } from "@/lib/stats";

export const GET = handle(async () => NextResponse.json(await getStats()));
