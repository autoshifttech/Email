"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api, useApi } from "@/lib/client";
import { IconChart, IconCheck, IconGear, IconGrid, IconHome, IconInbox, IconLogout, IconMail, IconPhone, IconPen, IconSpark, IconUsers } from "./icons";

type Item = { href: string; label: string; Icon: (p: { className?: string; size?: number }) => React.ReactElement; badge?: "unread" | "pending" };

const ITEMS: Item[] = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/inbox", label: "Inbox", Icon: IconInbox, badge: "unread" },
  { href: "/insights", label: "Insights", Icon: IconChart },
  { href: "/compose", label: "Compose", Icon: IconPen },
  { href: "/drafts", label: "Approvals", Icon: IconCheck, badge: "pending" },
  { href: "/accounts", label: "Email Accounts", Icon: IconMail },
  { href: "/contacts", label: "Contacts & Groups", Icon: IconUsers },
  { href: "/ai", label: "AI Keys", Icon: IconSpark },
  { href: "/settings", label: "Settings", Icon: IconGear },
];
const MOBILE = ["/", "/inbox", "/compose", "/drafts", "/more"];
const MORE_PATHS = ["/insights", "/accounts", "/contacts", "/ai", "/settings", "/more"];

type Stats = { unread: number; pending: number; demo?: boolean };

export function Nav() {
  const path = usePathname();
  const router = useRouter();
  const { data } = useApi<Stats>("/api/stats", { poll: 30_000 });
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };
  const count = (b?: Item["badge"]) => (b && data ? data[b] : 0);

  return (
    <>
      {data?.demo && (
        <div role="status" className="fixed top-2 left-1/2 -translate-x-1/2 md:left-[calc(50%+8.5rem)] z-50 rounded-full bg-white text-[#2b1fb0] text-xs font-semibold px-3.5 py-1.5 shadow-xl whitespace-nowrap">
          👀 Demo mode: sample data, changes aren&apos;t saved
        </div>
      )}
      {/* Desktop: floating glass sidebar */}
      <aside className="hidden md:flex fixed left-4 top-4 bottom-4 w-60 flex-col glass p-4 z-30">
        <Link href="/" className="flex items-center gap-2.5 px-2 mb-7 mt-1">
          <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg" />
          <span className="text-lg font-extrabold tracking-tight">MailBridge</span>
        </Link>
        <nav className="flex flex-col gap-1" aria-label="Main">
          {ITEMS.map(({ href, label, Icon, badge }) => {
            const on = active(href);
            const n = count(badge);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-3 rounded-full px-3.5 py-2.5 text-sm font-semibold transition ${on ? "bg-white text-[#2b1fb0] shadow-lg" : "text-white/85 hover:bg-white/12 hover:text-white"}`}
              >
                <Icon size={19} />
                {label}
                {n > 0 && <span className={`ml-auto rounded-full text-[10px] font-bold px-1.5 py-0.5 ${on ? "bg-[#4b33ea] text-white" : "bg-white text-[#2b1fb0]"}`}>{n > 99 ? "99+" : n}</span>}
              </Link>
            );
          })}
        </nav>
        <Link href="/download" className="btn mt-auto mb-2"><IconPhone size={17} /> Get the app</Link>
        <button onClick={logout} className="btn"><IconLogout size={17} /> Log out</button>
      </aside>

      {/* Mobile: floating pill tab bar */}
      <nav aria-label="Main" className="md:hidden fixed bottom-3 inset-x-3 z-40 glass !rounded-[30px] !bg-[#5038e6]/75 px-2 py-2 flex items-center justify-between mb-[env(safe-area-inset-bottom)]">
        {MOBILE.map((href) => {
          const item = href === "/more" ? { href, label: "More", Icon: IconGrid } as Item : ITEMS.find((x) => x.href === href)!;
          const on = href === "/more" ? MORE_PATHS.some((p) => path.startsWith(p)) : active(href);
          const n = count(item.badge);
          return (
            <Link
              key={href}
              href={href}
              aria-label={item.label}
              aria-current={on ? "page" : undefined}
              className={`relative flex items-center justify-center gap-1.5 rounded-full h-11 transition-all ${on ? "bg-white text-[#2b1fb0] px-4 font-semibold text-sm shadow-lg" : "text-white/85 w-11"}`}
            >
              <item.Icon size={20} />
              {on && <span>{item.label === "Approvals" ? "Approve" : item.label}</span>}
              {n > 0 && !on && <span className="absolute top-1 right-0.5 min-w-4 h-4 rounded-full bg-white text-[#2b1fb0] text-[9px] font-bold px-1 flex items-center justify-center">{n > 9 ? "9+" : n}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export const MORE_ITEMS = ITEMS.filter((i) => MORE_PATHS.includes(i.href));
