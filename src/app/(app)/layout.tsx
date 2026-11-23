import { Suspense } from "react";
import { Nav } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="md:pl-[17rem] pb-28 md:pb-10">
        <div className="mx-auto max-w-6xl px-4 md:px-8 pt-6 md:pt-9"><Suspense>{children}</Suspense></div>
      </main>
    </>
  );
}
