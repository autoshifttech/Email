import { prisma } from "@/lib/db";
import { Suspense } from "react";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  const setup = (await prisma.user.count()) === 0;
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <img src="/icons/icon.svg" alt="" className="h-16 w-16 mb-4 rounded-2xl shadow-2xl" />
          <h1 className="text-4xl font-extrabold tracking-tight">MailBridge</h1>
          <p className="muted text-center mt-2">Your inbox, summarized on WhatsApp.<br />AI replies, sent only with your approval.</p>
        </div>
        <Suspense><LoginForm setup={setup} /></Suspense>
      </div>
    </div>
  );
}
