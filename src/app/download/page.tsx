"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IconDownload } from "@/components/icons";

type Latest = { versionName: string; versionCode: number; size: number; sha256: string; builtAt: string; file: string };

export default function DownloadPage() {
  const [latest, setLatest] = useState<Latest | null | undefined>(undefined);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/downloads/latest.json", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then(setLatest).catch(() => setLatest(null));
  }, []);
  const copy = () => { navigator.clipboard.writeText(origin); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  const mb = latest ? (latest.size / 1024 / 1024).toFixed(1) : "";

  return (
    <main className="min-h-screen px-4 py-8 md:py-14">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
          <img src="/icons/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg" />
          <span className="text-lg font-extrabold tracking-tight">MailBridge</span>
        </Link>

        <section className="grid md:grid-cols-[1.1fr_0.9fr] gap-8 items-center">
          <div className="rise">
            <p className="text-sm font-semibold text-white/80 mb-2">Android app</p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight">Your inbox,<br /><span className="grad-text">in your pocket.</span></h1>
            <p className="muted mt-4 max-w-md">Install MailBridge on your phone: read AI summaries, approve AI-written replies and send emails, all in the same glass dashboard.</p>
            <div className="flex flex-wrap items-center gap-3 mt-7">
              {latest ? (
                <a href={latest.file} download className="btn btn-primary !px-6 !py-3.5 text-base"><IconDownload size={20} /> Download APK</a>
              ) : (
                <span className="btn !px-6 !py-3.5 text-base opacity-70 cursor-default"><IconDownload size={20} /> {latest === undefined ? "Checking…" : "APK is being built…"}</span>
              )}
              {latest && <span className="text-sm muted">v{latest.versionName} · {mb} MB · Android 7+</span>}
            </div>
            {latest === null && <p className="text-xs muted mt-3 max-w-md">The first build runs automatically on GitHub and takes about 5 minutes. Refresh this page shortly.</p>}
          </div>
          <PhoneMock />
        </section>

        <section className="grid md:grid-cols-3 gap-4 mt-12">
          <Step n={1} title="Download">Tap <b>Download APK</b> on your Android phone. If Chrome warns about the file type, tap <b>Download anyway</b>.</Step>
          <Step n={2} title="Install">Open the file. If asked, allow <b>Install unknown apps</b> for Chrome (Settings → Apps → Chrome), then tap <b>Install</b>.</Step>
          <Step n={3} title="Connect">
            Open MailBridge and enter this server address:
            <span className="flex gap-2 mt-2">
              <code className="flex-1 truncate !py-1.5 !px-2.5 !rounded-lg">{origin || "…"}</code>
              <button className="btn btn-sm" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
            </span>
            <a href={`mailbridge://setup?url=${encodeURIComponent(origin)}`} className="btn btn-primary btn-sm mt-3">Or tap here after installing</a>
          </Step>
        </section>

        <section className="glass p-5 mt-6 rise">
          <h2 className="font-bold">🍏 On iPhone?</h2>
          <p className="text-sm muted mt-1">Open this site in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b>. MailBridge installs as an app (PWA), no download needed.</p>
        </section>

        {latest && (
          <p className="text-[11px] faint mt-6 break-all">SHA-256: {latest.sha256} · built {new Date(latest.builtAt).toLocaleString()}</p>
        )}
        <div className="mt-8"><Link href="/" className="btn">← Back to dashboard</Link></div>
      </div>
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="glass p-5 rise">
      <div className="flex items-center gap-3 mb-2">
        <span className="h-8 w-8 rounded-full bg-white text-[#2b1fb0] font-bold flex items-center justify-center">{n}</span>
        <h3 className="font-bold text-lg">{title}</h3>
      </div>
      <div className="text-sm text-white/85 leading-relaxed">{children}</div>
    </div>
  );
}

/** Glass phone mock-up showing the app's home screen. */
function PhoneMock() {
  return (
    <div className="mx-auto w-[250px] rise" aria-hidden>
      <div className="rounded-[42px] p-2.5 bg-gradient-to-b from-white/50 to-white/10 shadow-2xl border border-white/40">
        <div className="rounded-[34px] overflow-hidden glass !rounded-[34px] p-4 h-[470px] flex flex-col gap-3">
          <div className="mx-auto h-1.5 w-16 rounded-full bg-white/40" />
          <div className="flex items-start justify-between mt-1">
            <div className="text-xl font-bold leading-tight">Good Day,<br />Mark!</div>
            <span className="h-9 w-9 rounded-full border-2 border-white/70" style={{ background: "linear-gradient(135deg,#ffb36b,#ff4d8d 60%,#8b5cff)" }} />
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/80">Unread emails</div>
            <div className="text-5xl font-bold tracking-tight">12<span className="text-sm muted font-medium">/48</span></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="glass-soft p-2.5"><div className="text-[10px] font-semibold">Today 📩</div><div className="text-xl font-bold mt-1">16</div></div>
            <div className="glass-soft p-2.5 row-span-2 flex flex-col">
              <div className="text-[10px] font-semibold">This week 📈</div>
              <svg viewBox="0 0 100 40" className="flex-1 w-full mt-2"><path d="M0 30 C15 28 20 33 35 30 C50 26 55 8 65 10 C75 12 80 30 100 32" fill="none" stroke="#ff5a7a" strokeWidth="2.5" /></svg>
              <div className="text-xl font-bold">68</div>
            </div>
            <div className="glass-soft p-2.5"><div className="text-[10px] font-semibold">Approvals ⏳</div><div className="text-xl font-bold mt-1">1</div></div>
          </div>
          <div className="glass-soft p-2.5 text-[11px] font-semibold">Link your WhatsApp to your account.<div className="mt-1.5 inline-block rounded-full bg-white text-[#2b1fb0] px-2.5 py-0.5">Link</div></div>
          <div className="mt-auto glass-soft !rounded-full p-1.5 flex items-center justify-between">
            <span className="rounded-full bg-white text-[#2b1fb0] text-[10px] font-bold px-3 py-1.5">⌂ Home</span>
            <span className="text-xs px-2">▤</span><span className="text-xs px-2">✎</span><span className="text-xs px-2">✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
