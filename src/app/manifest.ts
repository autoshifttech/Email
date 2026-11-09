import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MailBridge",
    short_name: "MailBridge",
    description: "AI email assistant with WhatsApp summaries and approved replies",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#15803d",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Inbox", url: "/inbox" },
      { name: "Compose", url: "/compose" },
      { name: "Approvals", url: "/drafts" },
    ],
  };
}
