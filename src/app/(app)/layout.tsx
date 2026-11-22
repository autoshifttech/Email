import { Suspense } from "react";
import { AppHeader, Dock } from "@/components/nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 md:px-8 pt-[max(14px,env(safe-area-inset-top))] pb-[calc(150px+env(safe-area-inset-bottom))]">
        <Suspense>
          <AppHeader />
          {children}
        </Suspense>
      </main>
      <Dock />
    </>
  );
}
