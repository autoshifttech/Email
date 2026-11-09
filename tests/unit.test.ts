import { describe, expect, it, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { parseButton, parseCommand } from "@/lib/command-parser";
import { decrypt, encrypt, keyHint, verifyMetaSignature } from "@/lib/crypto";
import { parseJsonLoose } from "@/lib/ai";
import { parseContactsCsv } from "@/lib/csv";
import { personalize, splitAddresses, isEmail } from "@/lib/recipients";
import { extractMessages } from "@/lib/whatsapp";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-123456";
});

describe("command parser", () => {
  it("recognises simple commands", () => {
    expect(parseCommand("help")).toEqual({ type: "help" });
    expect(parseCommand("  INBOX ")).toEqual({ type: "inbox" });
    expect(parseCommand("accounts")).toEqual({ type: "accounts" });
    expect(parseCommand("drafts")).toEqual({ type: "drafts" });
    expect(parseCommand("cancel")).toEqual({ type: "cancel" });
  });
  it("parses reply:", () => {
    expect(parseCommand("reply: Sounds good, see you then!")).toEqual({ type: "reply", text: "Sounds good, see you then!" });
  });
  it("parses new with subject", () => {
    expect(parseCommand("new team | Office closed | tell them office is closed Friday")).toEqual({
      type: "new", from: undefined, target: "team", subject: "Office closed", prompt: "tell them office is closed Friday",
    });
  });
  it("parses new without subject and with from:", () => {
    expect(parseCommand("new from:work bob@x.com | ask for the invoice")).toEqual({
      type: "new", from: "work", target: "bob@x.com", prompt: "ask for the invoice",
    });
  });
  it("treats subject 'auto' as AI-generated", () => {
    const c = parseCommand("new all | auto | holiday greetings");
    expect(c).toMatchObject({ type: "new", target: "all", subject: undefined, prompt: "holiday greetings" });
  });
  it("parses send (manual)", () => {
    expect(parseCommand("send a@b.com, c@d.com | Hi | Body | with pipe")).toEqual({
      type: "send", from: undefined, target: "a@b.com, c@d.com", subject: "Hi", body: "Body | with pipe",
    });
  });
  it("falls back to free text (AI prompt) when not a full command", () => {
    expect(parseCommand("send them the invoice tomorrow")).toEqual({ type: "text", text: "send them the invoice tomorrow" });
    expect(parseCommand("new idea: let's meet")).toEqual({ type: "text", text: "new idea: let's meet" });
  });
  it("parses button ids", () => {
    expect(parseButton("send:abc123")).toEqual({ action: "send", id: "abc123" });
    expect(parseButton("ai:e1")).toEqual({ action: "ai", id: "e1" });
    expect(parseButton("weird")).toBeNull();
    expect(parseButton(undefined)).toBeNull();
  });
});

describe("crypto", () => {
  it("round-trips encryption and uses random IVs", () => {
    const a = encrypt("s3cret-password");
    const b = encrypt("s3cret-password");
    expect(a).not.toEqual(b);
    expect(decrypt(a)).toBe("s3cret-password");
    expect(encrypt("")).toBe("");
  });
  it("detects tampering", () => {
    const enc = encrypt("hello");
    const parts = enc.split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => decrypt(parts.join(":"))).toThrow();
  });
  it("makes key hints", () => {
    expect(keyHint("gsk_abcdefghijklmnop")).toBe("gsk_••••mnop");
    expect(keyHint("")).toBe("");
  });
  it("verifies Meta signatures", () => {
    const body = '{"a":1}';
    const sig = "sha256=" + createHmac("sha256", "appsecret").update(body).digest("hex");
    expect(verifyMetaSignature(body, sig, "appsecret")).toBe(true);
    expect(verifyMetaSignature(body + " ", sig, "appsecret")).toBe(false);
    expect(verifyMetaSignature(body, null, "appsecret")).toBe(false);
    expect(verifyMetaSignature(body, "sha256=00", "appsecret")).toBe(false);
  });
});

describe("helpers", () => {
  it("parses loose JSON from model output", () => {
    expect(parseJsonLoose<{ a: number }>('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(parseJsonLoose<{ a: number }>('Sure! {"a": 2} hope that helps')).toEqual({ a: 2 });
    expect(parseJsonLoose("no json")).toBeNull();
  });
  it("parses contact CSV", () => {
    expect(parseContactsCsv("name,email\nJohn Smith, JOHN@x.com\nbad line\npriya@y.com\nRavi;ravi@z.com;vip")).toEqual([
      { email: "john@x.com", name: "John Smith", tags: "" },
      { email: "priya@y.com", name: "", tags: "" },
      { email: "ravi@z.com", name: "Ravi", tags: "vip" },
    ]);
  });
  it("personalizes broadcast bodies", () => {
    expect(personalize("Hi {{name}},\nHello", "Priya Sharma")).toBe("Hi Priya,\nHello");
    expect(personalize("Hi {{ name }},", null)).toBe("Hi there,");
  });
  it("splits and validates addresses", () => {
    expect(splitAddresses("A@x.com, <b@y.com>; c@z.com")).toEqual(["a@x.com", "b@y.com", "c@z.com"]);
    expect(isEmail("nope")).toBe(false);
  });
  it("extracts WhatsApp messages from webhook payloads", () => {
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.1", from: "911", timestamp: "1", type: "text", text: { body: "hi" } }] } }] }] };
    expect(extractMessages(payload)).toHaveLength(1);
    expect(extractMessages({})).toEqual([]);
  });
});
