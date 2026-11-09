import { z } from "zod";

export const accountSchema = z.object({
  label: z.string().trim().min(1).max(50),
  address: z.string().trim().email(),
  displayName: z.string().max(100).default(""),
  preset: z.string().default("custom"),
  imapHost: z.string().trim().min(1),
  imapPort: z.coerce.number().int().min(1).max(65535),
  imapSecure: z.boolean(),
  smtpHost: z.string().trim().min(1),
  smtpPort: z.coerce.number().int().min(1).max(65535),
  smtpSecure: z.boolean(),
  username: z.string().trim().min(1),
  password: z.string().optional(), // optional on update (keep existing)
  appendSent: z.boolean().default(true),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  notifyOnWhatsApp: z.boolean().default(true),
  signature: z.string().max(2000).default(""),
});

export const contactSchema = z.object({
  name: z.string().max(100).default(""),
  email: z.string().trim().toLowerCase().email(),
  tags: z.string().max(200).default(""),
  groupIds: z.array(z.string()).optional(),
});

export const groupSchema = z.object({
  name: z.string().trim().min(1).max(60),
  description: z.string().max(300).default(""),
  contactIds: z.array(z.string()).optional(),
});
