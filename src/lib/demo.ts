/**
 * DEMO MODE: lets the dashboard run with no database (e.g. a first Vercel deploy
 * before Supabase is connected). Active when DATABASE_URL is missing or
 * DEMO_MODE=true. All API GETs are answered from the sample data below; changes
 * are refused. Edge-safe (used from middleware): no Node or Prisma imports.
 */
export const isDemo = () => process.env.DEMO_MODE === "true" || !process.env.DATABASE_URL;

export const DEMO_WRITE_ERROR = "Demo mode: this is sample data and changes aren't saved. Add DATABASE_URL (Supabase) in Vercel to go live.";

const H = 3_600_000, D = 24 * H;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const account = <T extends { id: string; label: string; address: string }>(o: T & Record<string, unknown>) => ({
  displayName: "Mark", preset: "gmail", imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true,
  smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true, appendSent: false, isActive: true, isDefault: false,
  notifyOnWhatsApp: true, signature: "Best regards,\nMark", lastUid: 0, uidValidity: "", status: "connected",
  lastError: null, lastSyncAt: ago(2 * 60_000), createdAt: ago(20 * D), updatedAt: ago(D), hasPassword: true, ...o,
});

const ACCOUNTS = [
  account({ id: "acc_work", label: "Work", address: "mark@company.com", username: "mark@company.com", isDefault: true, unread: 2 }),
  account({ id: "acc_personal", label: "Personal", address: "mark@gmail.com", username: "mark@gmail.com", unread: 1 }),
  account({ id: "acc_shop", label: "Shop", address: "hello@markstore.in", username: "hello@markstore.in", preset: "zoho", imapHost: "imap.zoho.in", smtpHost: "smtp.zoho.in", status: "error", lastError: "Authentication failed: check the username and (app) password.", unread: 0 }),
];
const acc = (id: string) => { const a = ACCOUNTS.find((x) => x.id === id)!; return { label: a.label as string, address: a.address as string }; };

type DemoEmail = {
  id: string; accountId: string; direction: "IN" | "OUT"; fromName: string; fromAddress: string; to: string; subject: string;
  summary: string | null; priority: string | null; category: string | null; isRead: boolean; isArchived: boolean; age: number; body: string;
};

const EMAILS: DemoEmail[] = [
  { id: "em_1", accountId: "acc_work", direction: "IN", fromName: "Alice Johnson", fromAddress: "alice@client.com", to: "mark@company.com", subject: "Project kickoff next week", summary: "Alice wants to schedule the project kickoff next week and asks which day suits you; she proposes Tuesday or Wednesday afternoon.", priority: "high", category: "work", isRead: false, isArchived: false, age: 12 * 60_000, body: "Hi Mark,\n\nHope you're well! We're ready to start the project. Could we schedule the kickoff next week? Tuesday or Wednesday afternoon would work best for our team.\n\nLet me know what suits you.\n\nBest regards,\nAlice Johnson" },
  { id: "em_2", accountId: "acc_work", direction: "IN", fromName: "Stripe", fromAddress: "receipts@stripe.com", to: "mark@company.com", subject: "Your invoice #4821 is due", summary: "Invoice #4821 for $249.00 is due on 15 Nov. Pay via the dashboard to avoid service interruption.", priority: "urgent", category: "finance", isRead: false, isArchived: false, age: 48 * 60_000, body: "Invoice #4821\nAmount due: $249.00\nDue date: 15 November\n\nPay now from your Stripe dashboard to avoid any interruption to your service." },
  { id: "em_3", accountId: "acc_personal", direction: "IN", fromName: "Priya Sharma", fromAddress: "priya@company.com", to: "mark@gmail.com", subject: "Dinner on Saturday?", summary: "Priya invites you to dinner on Saturday at 8pm and asks you to confirm by Friday.", priority: "normal", category: "personal", isRead: false, isArchived: false, age: 2 * H, body: "Hey Mark!\n\nA few of us are getting dinner on Saturday at 8pm. Want to join? Let me know by Friday so I can book the table.\n\nPriya" },
  { id: "em_4", accountId: "acc_work", direction: "IN", fromName: "Rahul Mehta", fromAddress: "rahul@partner.io", to: "mark@company.com", subject: "Re: Partnership proposal", summary: "Rahul accepted the partnership terms and will send the signed contract by Friday.", priority: "normal", category: "sales", isRead: true, isArchived: false, age: 4 * H, body: "Hi Mark,\n\nGreat news: we're happy with the terms. I'll send the signed contract by Friday.\n\nCheers,\nRahul" },
  { id: "em_5", accountId: "acc_work", direction: "IN", fromName: "Product Hunt", fromAddress: "hello@producthunt.com", to: "mark@company.com", subject: "Top products this week", summary: "Weekly newsletter featuring trending AI tools.", priority: "low", category: "newsletter", isRead: true, isArchived: false, age: 7 * H, body: "This week's top launches: 10 AI tools you shouldn't miss…" },
  { id: "em_6", accountId: "acc_work", direction: "OUT", fromName: "Mark", fromAddress: "mark@company.com", to: "rahul@partner.io", subject: "Re: Partnership proposal", summary: null, priority: null, category: null, isRead: true, isArchived: false, age: 3 * H, body: "Hi Rahul,\n\nThat's great to hear, thank you! Looking forward to the contract.\n\nBest regards,\nMark" },
  { id: "em_7", accountId: "acc_personal", direction: "IN", fromName: "Airbnb", fromAddress: "automated@airbnb.com", to: "mark@gmail.com", subject: "Your trip to Goa is confirmed", summary: "Booking confirmed for 12–15 Dec in Goa; check-in from 2pm.", priority: "normal", category: "notification", isRead: true, isArchived: true, age: 2 * D, body: "Your reservation is confirmed. Check-in: 12 Dec after 2pm. Check-out: 15 Dec before 11am." },
];

const listItem = (e: DemoEmail) => ({
  id: e.id, accountId: e.accountId, direction: e.direction, fromName: e.fromName, fromAddress: e.fromAddress, to: e.to, subject: e.subject,
  snippet: e.body.replace(/\s+/g, " ").slice(0, 200), summary: e.summary, priority: e.priority, category: e.category, isRead: e.isRead,
  isArchived: e.isArchived, receivedAt: ago(e.age), notifiedAt: e.direction === "IN" ? ago(e.age - 30_000) : null, account: acc(e.accountId),
});

const CONTACTS = [
  { id: "c1", name: "Priya Sharma", email: "priya@company.com", tags: "design", g: ["g1", "g2"] },
  { id: "c2", name: "Ravi Kumar", email: "ravi@company.com", tags: "dev", g: ["g1"] },
  { id: "c3", name: "Sara Lee", email: "sara@client.com", tags: "", g: ["g3"] },
  { id: "c4", name: "Alice Johnson", email: "alice@client.com", tags: "vip", g: ["g3"] },
  { id: "c5", name: "Arjun Patel", email: "arjun@company.com", tags: "sales", g: ["g1", "g2"] },
];
const GROUPS = [
  { id: "g1", name: "Team", description: "Everyone at the office" },
  { id: "g2", name: "Leads", description: "Team leads" },
  { id: "g3", name: "Clients", description: "" },
];

const DRAFTS = [
  { id: "d1", accountId: "acc_work", replyToEmailId: "em_1", mode: "REPLY", recipients: JSON.stringify(["alice@client.com"]), groupId: null, subject: "Re: Project kickoff next week", body: "Hi Alice,\n\nThanks for reaching out! Tuesday at 3pm works perfectly for me. I'll send a calendar invite shortly.\n\nBest regards,\nMark", prompt: "accept, propose Tuesday 3pm", author: "AI", origin: "WHATSAPP", status: "PENDING_APPROVAL", sentCount: 0, error: null, waMessageId: null, sentAt: null, createdAt: ago(5 * 60_000), updatedAt: ago(5 * 60_000), account: acc("acc_work"), replyToEmail: { subject: "Project kickoff next week", fromAddress: "alice@client.com" } },
  { id: "d2", accountId: "acc_work", replyToEmailId: null, mode: "BROADCAST", recipients: JSON.stringify(["priya@company.com", "ravi@company.com", "arjun@company.com"]), groupId: "g1", subject: "Office closed this Friday", body: "Hi {{name}},\n\nJust a heads-up: the office will be closed this Friday for maintenance. Please plan to work from home.\n\nThanks,\nMark", prompt: "tell the team the office is closed Friday", author: "AI", origin: "WHATSAPP", status: "SENT", sentCount: 3, error: null, waMessageId: null, sentAt: ago(D), createdAt: ago(D + 600_000), updatedAt: ago(D), account: acc("acc_work"), replyToEmail: null },
];

function settings() {
  const s = (value: string, secret = false, hint = "") => ({ value: secret ? "" : value, secret, isSet: !!value || !!hint, ...(secret ? { hint } : {}) });
  return {
    WA_PHONE_NUMBER_ID: s("104857600112233"), WA_ACCESS_TOKEN: s("", true, "EAAG••••x9Qz"), WA_APP_SECRET: s("", true, "3f1a••••c2d0"),
    WA_VERIFY_TOKEN: s("mailbridge-verify"), OWNER_WHATSAPP_NUMBER: s("919876543210"), WA_TEMPLATE_NAME: s("new_email_alert"), WA_TEMPLATE_LANG: s("en"),
    WA_NOTIFICATIONS_ENABLED: s("true"), NOTIFY_MIN_PRIORITY: s("normal"), QUIET_HOURS_START: s("22:00"), QUIET_HOURS_END: s("07:00"),
    TIMEZONE: s("Asia/Kolkata"), OWNER_NAME: s("Mark"), AI_TONE: s("professional, friendly and concise"), AI_LANGUAGE: s("same language as the original email"),
  };
}

/** Deterministic pseudo-random history so charts look alive. */
function countFor(dayOffset: number, hour?: number) {
  const seed = Math.abs(Math.sin((dayOffset + 1) * 12.9898 + (hour ?? 0) * 78.233)) * 43758.5453;
  const r = seed - Math.floor(seed);
  if (hour === undefined) return 9 + Math.round(r * 14);
  const busy = hour >= 9 && hour <= 19 ? 1 : hour >= 7 && hour <= 22 ? 0.4 : 0.05;
  return Math.round(r * 4 * busy);
}

function insights(date: string) {
  const d = new Date(date + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const offset = Math.round((today.getTime() - d.getTime()) / D);
  const nowHour = new Date().getHours();
  const hourly = Array.from({ length: 24 }, (_, h) => (offset < 0 || (offset === 0 && h > nowHour) ? 0 : countFor(offset, h)));
  const received = hourly.reduce((a, b) => a + b, 0);
  const cat: [string, number][] = [["work", Math.ceil(received * 0.4)], ["finance", Math.floor(received * 0.2)], ["newsletter", Math.floor(received * 0.2)], ["personal", Math.floor(received * 0.12)]];
  return {
    date, received, unread: offset === 0 ? 3 : 0, important: Math.round(received * 0.2), sent: Math.round(received * 0.3), aiSent: Math.round(received * 0.15),
    pending: 1, hourly, byCategory: cat.filter(([, n]) => n > 0),
  };
}

function stats() {
  const inbox = EMAILS.filter((e) => e.direction === "IN" && !e.isArchived);
  const week = Array.from({ length: 7 }, (_, i) => { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - 6 + i); return { date: day.toISOString(), value: countFor(6 - i) }; });
  return {
    demo: true, ownerName: "Mark", accounts: ACCOUNTS.length, connected: ACCOUNTS.filter((a) => a.status === "connected").length,
    unread: inbox.filter((e) => !e.isRead).length, inboxTotal: inbox.length, today: week[6].value, pending: 1, sentToday: 4, contacts: CONTACTS.length,
    week, ai: { name: "Groq (free tier)", model: "llama-3.3-70b-versatile", source: "dashboard" }, whatsapp: true,
    activity: [
      { id: "a1", type: "notify", message: "WhatsApp summary sent: “Project kickoff next week”", createdAt: ago(11 * 60_000) },
      { id: "a2", type: "draft", message: "AI drafted a reply to Alice Johnson (awaiting approval)", createdAt: ago(5 * 60_000) },
      { id: "a3", type: "send", message: "Sent “Office closed this Friday” to 3/3 recipient(s)", createdAt: ago(D) },
      { id: "a4", type: "error", message: "Shop: Authentication failed: check the username and (app) password.", createdAt: ago(3 * H) },
    ],
  };
}

/** Answer an API request in demo mode. Returns [status, body]. */
export function demoApi(method: string, url: URL): [number, unknown] {
  const p = url.pathname.replace(/\/$/, "");
  const q = url.searchParams;
  if (p === "/api/auth/logout") return [200, { ok: true }];
  if (p === "/api/whatsapp/webhook") return [200, { ok: true, demo: true }];
  if (p === "/api/ai/draft" && method === "POST") {
    return [200, { subject: "Re: Project kickoff next week", body: "Hi Alice,\n\nThank you for reaching out! Tuesday at 3pm works well for me. I'll send over a calendar invite with the agenda shortly.\n\nBest regards,\nMark\n\n(Demo mode: connect a database and an AI key for real AI drafts.)" }];
  }
  if (method !== "GET") return [403, { error: DEMO_WRITE_ERROR }];

  if (p === "/api/health") return [200, { ok: true, name: "MailBridge", demo: true }];
  if (p === "/api/stats") return [200, stats()];
  if (p === "/api/insights") return [200, insights(q.get("date") ?? new Date().toISOString().slice(0, 10))];
  if (p === "/api/accounts") return [200, ACCOUNTS];
  if (p.startsWith("/api/accounts/")) return [200, ACCOUNTS.find((a) => a.id === p.split("/")[3]) ?? ACCOUNTS[0]];
  if (p === "/api/emails") {
    const box = q.get("box") ?? "inbox", accountId = q.get("accountId"), s = (q.get("q") ?? "").toLowerCase();
    let items = EMAILS.filter((e) =>
      box === "sent" ? e.direction === "OUT" :
      box === "archived" ? e.direction === "IN" && e.isArchived :
      box === "unread" ? e.direction === "IN" && !e.isArchived && !e.isRead :
      box === "important" ? e.direction === "IN" && !e.isArchived && (e.priority === "high" || e.priority === "urgent") :
      e.direction === "IN" && !e.isArchived);
    if (accountId) items = items.filter((e) => e.accountId === accountId);
    if (s) items = items.filter((e) => `${e.subject} ${e.fromName} ${e.fromAddress} ${e.body}`.toLowerCase().includes(s));
    return [200, { total: items.length, page: 1, pageSize: 30, items: items.map(listItem) }];
  }
  if (p.startsWith("/api/emails/")) {
    const e = EMAILS.find((x) => x.id === p.split("/")[3]) ?? EMAILS[0];
    return [200, { ...listItem(e), cc: "", text: e.body, html: "", uid: 1, mailbox: "INBOX", messageId: null, inReplyTo: null, references: "", waMessageId: null, createdAt: ago(e.age) }];
  }
  if (p === "/api/drafts") { const st = q.get("status"); return [200, st ? DRAFTS.filter((d) => d.status === st) : DRAFTS]; }
  if (p === "/api/contacts") return [200, CONTACTS.map(({ g, ...c }) => ({ ...c, createdAt: ago(10 * D), groups: GROUPS.filter((x) => g.includes(x.id)).map(({ id, name }) => ({ id, name })) }))];
  if (p === "/api/groups") return [200, GROUPS.map((g) => { const ids = CONTACTS.filter((c) => c.g.includes(g.id)).map((c) => c.id); return { ...g, createdAt: ago(10 * D), contactIds: ids, memberCount: ids.length }; })];
  if (p === "/api/ai-providers") {
    return [200, { envFallback: false, envModel: null, providers: [
      { id: "p1", name: "Groq (free tier)", preset: "groq", baseUrl: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", keyHint: "gsk_••••abcd", hasKey: true, isActive: true, lastTestedAt: ago(H), lastTestOk: true, lastError: null, createdAt: ago(5 * D), updatedAt: ago(H) },
      { id: "p2", name: "Google Gemini (free tier)", preset: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/", model: "gemini-2.5-flash", keyHint: "AIza••••9876", hasKey: true, isActive: false, lastTestedAt: null, lastTestOk: null, lastError: null, createdAt: ago(4 * D), updatedAt: ago(4 * D) },
    ] }];
  }
  if (p === "/api/settings") {
    const origin = url.origin;
    return [200, { settings: settings(), webhookUrl: `${origin}/api/whatsapp/webhook`, syncUrl: `${origin}/api/cron/sync?key=demo-key-connect-a-database`, serverless: true }];
  }
  return [404, { error: "Not found (demo mode)" }];
}
