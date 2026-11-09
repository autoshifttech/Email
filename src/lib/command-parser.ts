// Pure parsing (no DB) so it can be unit-tested.

export type Command =
  | { type: "help" }
  | { type: "inbox" }
  | { type: "accounts" }
  | { type: "drafts" }
  | { type: "cancel" }
  | { type: "reply"; text: string }
  | { type: "new"; from?: string; target: string; subject?: string; prompt: string }
  | { type: "send"; from?: string; target: string; subject: string; body: string }
  | { type: "text"; text: string };

export type ButtonAction = { action: "ai" | "manual" | "ignore" | "send" | "edit" | "cancel"; id: string };

export function parseButton(id: string | undefined): ButtonAction | null {
  const m = /^(ai|manual|ignore|send|edit|cancel):(.+)$/.exec(id ?? "");
  return m ? { action: m[1] as ButtonAction["action"], id: m[2] } : null;
}

/** Pulls an optional leading "from:<label>" token off the target part. */
function splitFrom(s: string): { from?: string; rest: string } {
  const m = /^from:(\S+)\s+([\s\S]*)$/i.exec(s.trim());
  return m ? { from: m[1], rest: m[2].trim() } : { rest: s.trim() };
}

export function parseCommand(input: string): Command {
  const text = (input ?? "").trim();
  const lower = text.toLowerCase();

  if (["help", "menu", "?", "/help", "commands"].includes(lower)) return { type: "help" };
  if (["inbox", "unread", "/inbox"].includes(lower)) return { type: "inbox" };
  if (["accounts", "/accounts"].includes(lower)) return { type: "accounts" };
  if (["drafts", "pending", "/drafts"].includes(lower)) return { type: "drafts" };
  if (["cancel", "stop", "/cancel"].includes(lower)) return { type: "cancel" };

  const reply = /^reply\s*:\s*([\s\S]+)$/i.exec(text);
  if (reply) return { type: "reply", text: reply[1].trim() };

  // new <target> | <subject> | <prompt>      or      new <target> | <prompt>
  const nw = /^(?:new|write|compose)\s+([\s\S]+)$/i.exec(text);
  if (nw && nw[1].includes("|")) {
    const parts = nw[1].split("|").map((p) => p.trim());
    const { from, rest } = splitFrom(parts[0]);
    if (rest && parts.length >= 2) {
      if (parts.length === 2) return { type: "new", from, target: rest, prompt: parts[1] };
      const subject = parts[1] && !/^auto$/i.test(parts[1]) ? parts[1] : undefined;
      return { type: "new", from, target: rest, subject, prompt: parts.slice(2).join(" | ") };
    }
  }

  // send <target> | <subject> | <body>   (your exact words, no AI)
  const sd = /^send\s+([\s\S]+)$/i.exec(text);
  if (sd) {
    const parts = sd[1].split("|").map((p) => p.trim());
    if (parts.length >= 3) {
      const { from, rest } = splitFrom(parts[0]);
      if (rest) return { type: "send", from, target: rest, subject: parts[1], body: parts.slice(2).join(" | ") };
    }
  }

  return { type: "text", text };
}

export const HELP_TEXT = `*MailBridge commands* 📬

*Reply to an email*
• Tap *🤖 Reply with AI* on an email, or swipe-reply to it with instructions, e.g. _"accept, propose Tuesday 3pm"_
• Swipe-reply with *reply: <text>* to send your exact words

*New email (AI writes it)*
• new <to> | <subject> | <instructions>
• new <to> | <instructions>   _(AI writes the subject)_
<to> = email(s), a contact name, a group name, or *all*
e.g. _new team | Office closed Friday | tell everyone the office is closed this Friday for maintenance_

*New email (your exact words)*
• send <to> | <subject> | <body>

Add *from:<account label>* before <to> to choose the sending account.

*Other*
• inbox – latest unread emails
• drafts – drafts waiting for approval
• accounts – connected mailboxes
• cancel – cancel the current step

Every email is shown to you as a draft first. Nothing is sent until you tap ✅ Send.`;
