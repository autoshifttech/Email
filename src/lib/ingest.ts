import { prisma, logActivity } from "./db";
import { summarizeEmail, AiNotConfiguredError } from "./ai";
import { notifyEmail } from "./notify";
import { errMsg } from "./auth";

/** AI-summarize a stored email (falls back to the snippet if no AI is configured). */
export async function summarizeStoredEmail(emailId: string) {
  const email = await prisma.email.findUniqueOrThrow({ where: { id: emailId } });
  try {
    const s = await summarizeEmail(email);
    return prisma.email.update({
      where: { id: emailId },
      data: { summary: s.summary, priority: s.priority, category: s.category },
    });
  } catch (e) {
    if (!(e instanceof AiNotConfiguredError)) await logActivity("error", `AI summary failed: ${errMsg(e)}`);
    return prisma.email.update({ where: { id: emailId }, data: { summary: null, priority: email.priority ?? "normal" } });
  }
}

/** Pipeline for a freshly received email: summarize → WhatsApp. */
export async function processNewEmail(emailId: string) {
  await summarizeStoredEmail(emailId);
  try {
    const r = await notifyEmail(emailId);
    if (r.sent) await logActivity("notify", `WhatsApp summary sent for email ${emailId}`);
  } catch (e) {
    await logActivity("error", `Notify failed: ${errMsg(e)}`);
  }
}
