import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { RegisterSW } from "@/components/register-sw";
import { Backdrop } from "@/components/backdrop";

export const metadata: Metadata = {
  title: { default: "MailBridge", template: "%s · MailBridge" },
  description: "AI email assistant: inbox summaries on WhatsApp, AI-drafted replies with your approval.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MailBridge", statusBarStyle: "default" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = {
  themeColor: "#4b33ea",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans">
        <Backdrop />
        <ToastProvider>{children}</ToastProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
