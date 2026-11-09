# 📬 MailBridge

**Your inbox, summarized on WhatsApp. AI-written replies are sent only after you approve them.**

MailBridge watches your email accounts in real time. When a new email arrives, the AI summarizes it and sends the summary to your WhatsApp. You can reply from WhatsApp in two ways: write the reply yourself, or tell the AI what to say ("accept, propose Tuesday 3pm"). Either way you get a draft, and **nothing is sent until you tap ✅ Send**. You can also send new emails to one person, a group, or all your contacts, from WhatsApp or from the web dashboard (which you can install on your phone as an app).

| Home | Insights | Approvals |
|---|---|---|
| ![](docs/screenshots/m-home.png) | ![](docs/screenshots/m-insights.png) | ![](docs/screenshots/m-drafts.png) |

![Desktop dashboard](docs/screenshots/d-home.png)

The UI uses a **glassmorphism** design: a vivid indigo background with glowing 3D ribbons, frosted-glass cards, big bold numbers, white pill buttons and a floating tab bar on mobile.

---

## ✨ Features

**Email → WhatsApp**
- Real-time inbox watching (IMAP IDLE) for **multiple accounts**: Gmail, Outlook, Zoho, Yahoo, Hostinger, any IMAP/SMTP
- AI **summary, priority** (low/normal/high/urgent) and **category** for every email
- WhatsApp card with **🤖 Reply with AI · ✍️ Reply myself · 🙈 Ignore** buttons
- Notification rules: minimum priority, quiet hours (urgent mail still comes through), per-account on/off

**WhatsApp → Email**
- Swipe-reply to an email card with instructions and the AI writes the reply
- `reply: <text>` sends your exact words
- `new <to> | <subject> | <instructions>` makes the AI write a new email
- `<to>` can be email address(es), a contact name, a **group** name, or **all**
- Every draft comes back with **✅ Send · ✏️ Edit · ❌ Cancel**. Edit lets the AI revise it, or you can replace the text yourself
- Broadcasts go out as **one personal email per recipient**, with `{{name}}` replaced by each contact's name

**Dashboard (web + installable PWA)**
- **Home**: greeting, unread count, today / this-week / approvals tiles with a 7-day trend line
- **Insights**: pick any day to see emails received, sent, sent by AI and important, plus an emails-by-hour chart and top categories
- **Email accounts**: add, edit, delete, enable/disable, set default, test connection, see live status
- **AI Keys**: add, edit, delete, test and switch between AI providers and API keys (Groq, Gemini, OpenRouter, OpenAI, Ollama, any OpenAI-compatible API)
- **Inbox**: all accounts or one, search, unread / important / sent / archived, AI summary, reply, AI reply, archive, delete (optionally on the server too), forward to WhatsApp
- **Compose**: to addresses, a group or everyone; write it yourself or with AI
- **Approvals**: review, edit, AI-revise, approve or reject drafts from WhatsApp and the dashboard
- **Contacts & Groups**: create, edit, delete, CSV import
- **Settings**: WhatsApp credentials, notification rules, AI tone/language/sign-off, password

**Security**
- Mailbox passwords, AI keys and WhatsApp tokens are **AES-256-GCM encrypted** in the database and never sent to the browser
- WhatsApp webhook **signature verification** (`X-Hub-Signature-256`). Only **your** number can give commands
- Login-protected dashboard with login rate limiting. Each draft can only be sent once, so a double tap won't send it twice

---

## 🗄️ Database

MailBridge stores its data in **PostgreSQL**: accounts, emails, summaries, drafts, contacts, AI keys and settings. Any Postgres works:

- **Supabase** (free tier). Recommended for Vercel, see below.
- Neon or Vercel Postgres.
- The Postgres container in `docker-compose.yml`.

Tables are created automatically by the migrations in `prisma/migrations` (`npm run db:migrate`, which runs automatically on Vercel and in Docker).

---

## ▲ Deploy on Vercel + Supabase (free)

**1. Create the Supabase database**
1. Create a project at <https://supabase.com>.
2. Open **Connect** (or Project Settings → Database → Connection string) and copy two URIs:
   - **Transaction pooler** (port **6543**): use it as `DATABASE_URL` and add `?pgbouncer=true&connection_limit=1` to the end.
   - **Session pooler** or **Direct connection** (port **5432**): use it as `DIRECT_URL`.
   - Replace `[YOUR-PASSWORD]` with your database password. If the password has special characters, URL-encode them.

**2. Import the repo on Vercel and add Environment Variables** (Project → Settings → Environment Variables)

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URI + `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase session/direct URI (port 5432) |
| `AUTH_SECRET` | output of `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | another `openssl rand -hex 32` (keep it safe, never change it) |
| `APP_URL` | your Vercel URL, e.g. `https://email-yourname.vercel.app` |

Deploy. The `vercel-build` script creates the database tables automatically.

**3. Turn on automatic mail checking.** Vercel functions can't keep a mailbox connection open, so new mail is fetched by calling a sync URL on a schedule:
1. Open your app → **Settings → 🔄 Automatic mail check** and copy the **Sync URL**.
2. At <https://cron-job.org> (free), create a job that opens that URL every **1–2 minutes**.

New emails then reach WhatsApp within a minute or two. You can also press **Sync now** on the Email Accounts page at any time.

> Vercel's own Cron Jobs run at most once a day on the free Hobby plan, which is why an external scheduler is used.
> If you want **instant** delivery (IMAP IDLE), run the worker on any always-on host (VPS, Railway, Render, Fly.io) with `npm run worker`, pointing at the same database. You can keep the dashboard on Vercel.

**4.** Set the WhatsApp webhook to `https://<your-app>.vercel.app/api/whatsapp/webhook` (see "Connect WhatsApp" below).

---

## 🚀 Quick start (local)

Requirements: **Node.js 20+** and a PostgreSQL database (local, Docker or Supabase)

```bash
git clone https://github.com/autoshifttech/email.git
cd email
npm install
cp .env.example .env
```

Edit `.env` and set two random secrets:

```bash
openssl rand -hex 32   # paste into AUTH_SECRET
openssl rand -hex 32   # paste into ENCRYPTION_KEY
```

Set `DATABASE_URL` and `DIRECT_URL` in `.env`, then create the tables, build, and run the web app and the email worker:

```bash
npm run db:migrate
npm run build
npm run start:all
```

Open **http://localhost:3000**, create your owner account, then follow the **"Finish setting up"** checklist on the Overview page.

> For development, use `npm run dev:all` (hot reload).

### Run with Docker

```bash
cp .env.example .env    # set AUTH_SECRET, ENCRYPTION_KEY, APP_URL
docker compose up -d --build
```

This starts Postgres plus MailBridge (web app and real-time worker).

---

## 🔧 Setup guides

### 1. Add an email account (Gmail example)
1. Turn on **2-Step Verification** for your Google account.
2. Create an **App Password** at <https://myaccount.google.com/apppasswords>.
3. In MailBridge go to **Email Accounts → + Add account → Gmail**, enter your address and the 16-character app password, click **Test connection**, then **Add account**.

Within a few seconds the status turns **Connected**. Your 20 most recent emails are imported without notifications. New emails from then on are summarized and sent to WhatsApp.

### 2. Add a free AI key
Go to **AI Keys → + Add AI key** and pick a provider:

| Provider | Free? | Get a key |
|---|---|---|
| **Groq** (recommended) | ✅ free tier | <https://console.groq.com/keys> |
| **Google Gemini** | ✅ free tier | <https://aistudio.google.com/apikey> |
| **OpenRouter** (`:free` models) | ✅ | <https://openrouter.ai/keys> |
| **Ollama** (your own machine) | ✅ | <https://ollama.com> |
| OpenAI | paid | <https://platform.openai.com/api-keys> |

Paste the key, click **Test**, then **Save**. You can store several keys and switch the active one with **Use this**, for example when one hits its rate limit.

### 3. Connect WhatsApp (Meta WhatsApp Cloud API)
1. Go to <https://developers.facebook.com> → **My Apps → Create app** → type **Business** → add the **WhatsApp** product.
2. Under **WhatsApp → API Setup**, copy the **Phone number ID**. Add your personal number as a recipient and verify it. For a quick test you can use Meta's free test number.
3. Create a **permanent access token**: Business Settings → **System users** → add a user → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`. (The 24-hour temporary token also works for testing.)
4. Copy the **App secret** from **App settings → Basic**.
5. In MailBridge **Settings → WhatsApp**, fill in your number (with country code, e.g. `919876543210`), the phone number ID, the access token, the app secret, and a **verify token** you make up. Save, then click **Send test message**.
6. **Webhook**: in Meta → WhatsApp → **Configuration**, set the **Callback URL** to the one shown in MailBridge settings (`https://your-domain/api/whatsapp/webhook`) and the same **verify token**. Then **subscribe to `messages`**.
   - Meta needs a public HTTPS URL. On a local machine you can use a free tunnel:
     ```bash
     npx cloudflared tunnel --url http://localhost:3000
     ```
     Then set `APP_URL` in `.env` to the tunnel URL.
7. **Template for the 24-hour rule.** WhatsApp only allows free-form messages within 24 hours of your last message to the bot. To still receive alerts after that, create a message template in **WhatsApp Manager → Message templates**:
   - Name: `new_email_alert`, Category: **Utility**, Language: English
   - Body: `📧 New email from {{1}}. Subject: {{2}}. Summary: {{3}}. Reply to this message to answer.`

   MailBridge switches to this template automatically when needed. Sending any message to the bot (for example `help`) reopens the 24-hour window.

---

## 💬 WhatsApp commands

| You send | What happens |
|---|---|
| *(tap)* **🤖 Reply with AI** | Asks what the reply should say, then sends you a draft |
| *(swipe-reply to an email card)* `accept, propose Tuesday 3pm` | AI writes the reply and sends you the draft |
| *(swipe-reply)* `reply: Thanks, received!` | Draft with your exact words |
| `new priya@x.com \| Invoice \| ask politely for payment of invoice 42` | AI writes a new email |
| `new team \| tell everyone the office is closed Friday` | Group broadcast; the AI writes the subject |
| `new all \| Diwali greetings \| warm festival wishes` | Personal email to **every contact** |
| `send bob@x.com \| Hi \| See you at 5.` | New email with your exact words |
| `new from:personal mom@x.com \| ...` | Choose the sending account |
| `inbox` | Latest unread emails as cards |
| `drafts` | Drafts waiting for approval |
| `accounts` | Mailbox status |
| `help` / `cancel` | Show commands / cancel the current step |

Every draft comes back with **✅ Send · ✏️ Edit · ❌ Cancel**. With **Edit** you can send `make it shorter`, `text: <new body>` or `subject: <new subject>`.

---

## ☁️ Other hosting options

| Host | Database | New-mail detection |
|---|---|---|
| **Vercel** (see above) | Supabase / Neon | Sync URL every 1–2 min (cron-job.org) |
| **VPS** (Hetzner, DigitalOcean…) with `docker compose up -d` | bundled Postgres or Supabase | real-time worker (IMAP IDLE) |
| **Railway / Render / Fly.io** (Dockerfile) | their Postgres or Supabase | real-time worker |

Always set `APP_URL` to your public HTTPS URL so the dashboard shows the correct webhook and sync URLs.

---

## 🧪 Tests

```bash
npm test             # unit tests (command parser, crypto, webhook signatures, CSV, ...)
npm run typecheck
```

The end-to-end test runs a real IMAP server, a real SMTP server, the web app and the worker, with mock AI and WhatsApp APIs. It covers 55 checks: account CRUD, AI key management, incoming mail → summary → WhatsApp, AI reply → edit → approve → threaded send, cancel, broadcast, security checks, dashboard actions and the serverless (Vercel) sync URL.

```bash
pip install pymap                       # IMAP test server
npm run build
# uses (and WIPES) a throwaway database, default postgres://postgres:postgres@localhost:5432/mailbridge_e2e
PYMAP=$(which pymap) E2E_DATABASE_URL=postgresql://... npm run test:e2e
```

---

## 🗂️ Project structure

```
prisma/schema.prisma          Database models (PostgreSQL) + migrations/
worker/index.ts               Real-time IMAP IDLE watcher (always-on hosts)
src/lib/sync.ts               Mailbox sync shared by the worker and /api/cron/sync (Vercel)
src/lib/
  ai.ts, ai-presets.ts        AI provider (OpenAI-compatible), summaries, drafts, revisions
  mail.ts, mail-presets.ts    IMAP/SMTP, parsing, sending, connection tests
  whatsapp.ts                 WhatsApp Cloud API client
  commands.ts                 WhatsApp conversation handler (buttons, sessions, drafts)
  command-parser.ts           Pure command parser + help text
  notify.ts                   Email cards, draft previews, notification rules
  send.ts                     Approved-draft sending (reply, new, broadcast)
  settings.ts, crypto.ts      Encrypted settings, AES-GCM, webhook signatures
src/app/api/...               REST API used by the dashboard + WhatsApp webhook
src/app/(app)/...             Dashboard pages
tests/                        Unit + end-to-end tests
```

## Environment variables

See [`.env.example`](.env.example). Only `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY` and `APP_URL` are required. AI and WhatsApp settings can be managed entirely from the dashboard. Optional extras: `CRON_SECRET` (sync URL key, auto-generated if empty), `SYNC_MAX_EMAILS` (emails processed per account per scheduled sync, default 10), `BACKFILL_COUNT` (emails imported on first connect, default 20), `BROADCAST_DELAY_MS` (pause between broadcast emails, default 1200), `MAIL_TLS_INSECURE=true` (allow self-signed mail servers).

> ⚠️ Keep `ENCRYPTION_KEY` safe and don't change it. Stored passwords and keys can't be decrypted without it.
