import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { RegisterSW } from "@/components/register-sw";

export const metadata: Metadata = {
  title: { default: "MailBridge", template: "%s · MailBridge" },
  description: "AI email assistant: inbox summaries on WhatsApp, AI-drafted replies with your approval.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MailBridge", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
