"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MORE_ITEMS } from "@/components/nav";
import { IconLogout, IconPhone } from "@/components/icons";
import { api } from "@/lib/client";
import { PageHeader } from "@/components/ui";

export default function More() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="More" />
      <div className="grid grid-cols-2 gap-3">
        {MORE_ITEMS.filter((i) => i.href !== "/more").map(({ href, label, Icon }) => (
          <Link key={href} href={href} className="glass p-4 rise hover:bg-white/10 flex flex-col gap-6">
            <span className="h-11 w-11 rounded-2xl bg-white text-[#2b1fb0] flex items-center justify-center shadow-lg"><Icon size={22} /></span>
            <span className="font-semibold leading-tight">{label}</span>
          </Link>
        ))}
        <Link href="/download" className="glass p-4 rise hover:bg-white/10 flex flex-col gap-6">
          <span className="h-11 w-11 rounded-2xl bg-white text-[#2b1fb0] flex items-center justify-center shadow-lg"><IconPhone size={22} /></span>
          <span className="font-semibold leading-tight">Get the Android app</span>
        </Link>
        <button className="glass p-4 rise hover:bg-white/10 flex flex-col gap-6 text-left" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
          <span className="h-11 w-11 rounded-2xl bg-white/20 border border-white/40 flex items-center justify-center"><IconLogout size={22} /></span>
          <span className="font-semibold">Log out</span>
        </button>
      </div>
    </>
  );
}
