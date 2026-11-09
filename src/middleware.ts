import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "./lib/session";
import { demoApi, isDemo } from "./lib/demo";

const PUBLIC = ["/login", "/api/auth/login", "/api/auth/setup", "/api/whatsapp/webhook", "/api/cron/sync", "/api/health", "/manifest.webmanifest", "/sw.js", "/offline.html", "/download", "/downloads"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // No database configured → read-only demo with sample data, no login.
  if (isDemo()) {
    if (pathname.startsWith("/api/")) {
      const [status, body] = demoApi(req.method, req.nextUrl);
      return NextResponse.json(body, { status });
    }
    if (pathname === "/login") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  }
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
