"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconGear, IconLogout, IconMail, IconPen, IconPhone, IconSpark, IconUsers } from "@/components/icons";
import { api } from "@/lib/client";
import { hopEl } from "@/lib/fx";

const ITEMS = [
  { href: "/compose", label: "Compose", sub: "Write or AI-draft an email", Icon: IconPen, hot: true },
  { href: "/accounts", label: "Email Accounts", sub: "Add, edit, sync mailboxes", Icon: IconMail },
  { href: "/contacts", label: "Contacts & Groups", sub: "People and broadcast lists", Icon: IconUsers },
  { href: "/ai", label: "AI Keys", sub: "Groq, Gemini, OpenRouter…", Icon: IconSpark },
  { href: "/settings", label: "Settings", sub: "WhatsApp, alerts, style", Icon: IconGear },
  { href: "/download", label: "Get the app", sub: "Android APK · iPhone PWA", Icon: IconPhone },
];

export default function More() {
  const router = useRouter();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {ITEMS.map(({ href, label, sub, Icon, hot }) => (
        <Link key={href} href={href} className="card p-4 rv flex flex-col gap-5 active:scale-[.98] transition-transform" onClick={(e) => hopEl(e.currentTarget.querySelector(".mi"))}>
          <span className={`mi h-12 w-12 rounded-2xl grid place-items-center ${hot ? "btn-primary" : "circle !w-12 !h-12 !rounded-2xl"}`}><Icon size={22} /></span>
          <span>
            <span className="block font-semibold leading-tight">{label}</span>
            <span className="block small mt-0.5">{sub}</span>
          </span>
        </Link>
      ))}
      <button type="button" className="card p-4 rv flex flex-col gap-5 text-left active:scale-[.98] transition-transform" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
        <span className="circle !w-12 !h-12 !rounded-2xl text-[#b42828]"><IconLogout size={22} /></span>
        <span className="font-semibold">Log out</span>
      </button>
    </div>
  );
}
