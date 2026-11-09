"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MORE_ITEMS } from "@/components/nav";
import { api } from "@/lib/client";
import { PageHeader } from "@/components/ui";

export default function More() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="More" />
      <div className="panel divide-y divide-[var(--border)]">
        {MORE_ITEMS.map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 p-4">
            <span className="text-xl">{i.icon}</span>
            <span className="font-medium">{i.label}</span>
            <span className="ml-auto muted">›</span>
          </Link>
        ))}
        <button className="flex w-full items-center gap-3 p-4 text-red-600" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/login"); }}>
          <span className="text-xl">🚪</span> Log out
        </button>
      </div>
    </>
  );
}
