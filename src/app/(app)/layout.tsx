import { Suspense } from "react";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="md:pl-60 pb-24 md:pb-10">
        <div className="mx-auto max-w-6xl px-4 md:px-8 pt-5 md:pt-8"><Suspense>{children}</Suspense></div>
      </main>
    </>
  );
}
