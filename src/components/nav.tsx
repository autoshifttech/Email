"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client";

const ITEMS = [
  { href: "/", label: "Overview", icon: "🏠" },
  { href: "/inbox", label: "Inbox", icon: "📥", badge: "unread" as const },
  { href: "/compose", label: "Compose", icon: "✏️" },
  { href: "/drafts", label: "Approvals", icon: "✅", badge: "pending" as const },
  { href: "/accounts", label: "Email Accounts", icon: "📧" },
  { href: "/contacts", label: "Contacts & Groups", icon: "👥" },
  { href: "/ai", label: "AI Keys", icon: "🤖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];
const MOBILE = ["/", "/inbox", "/compose", "/drafts", "/more"];

type Stats = { unread: number; pending: number };

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { data } = useApi<Stats>("/api/stats", { poll: 30_000 });
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const badge = (b?: "unread" | "pending") => {
    const n = b && data ? data[b] : 0;
    return n ? <span className="ml-auto rounded-full bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5">{n > 99 ? "99+" : n}</span> : null;
  };

  return (
    <>
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-60 flex-col border-r border-app bg-[var(--panel)] p-4">
        <Link href="/" className="flex items-center gap-2 px-2 mb-6">
          <img src="/icons/icon.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-extrabold tracking-tight">MailBridge</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                active(i.href) ? "bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "hover:bg-black/5 dark:hover:bg-white/5"
              }`}
            >
              <span>{i.icon}</span>
              {i.label}
              {badge(i.badge)}
            </Link>
          ))}
        </nav>
        <button onClick={logout} className="btn mt-auto">Log out</button>
      </aside>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-app bg-[var(--panel)] grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {MOBILE.map((href) => {
          const i = href === "/more" ? { href, label: "More", icon: "☰" } : ITEMS.find((x) => x.href === href)!;
          const isActive = href === "/more" ? ["/accounts", "/contacts", "/ai", "/settings", "/more"].some((p) => path.startsWith(p)) : active(href);
          return (
            <Link key={href} href={href} className={`relative flex flex-col items-center py-2 text-[11px] ${isActive ? "text-green-700 dark:text-green-400 font-semibold" : "muted"}`}>
              <span className="text-lg leading-none">{i.icon}</span>
              {i.label === "Email Accounts" ? "Accounts" : i.label}
              {"badge" in i && i.badge && data?.[i.badge] ? (
                <span className="absolute top-1 right-[22%] rounded-full bg-green-600 text-white text-[9px] font-bold px-1">{data[i.badge]}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export const MORE_ITEMS = ITEMS.filter((i) => ["/accounts", "/contacts", "/ai", "/settings"].includes(i.href));
