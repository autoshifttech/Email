export type MailPreset = {
  id: string;
  name: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  appendSent: boolean;
  help: string;
};

export const MAIL_PRESETS: MailPreset[] = [
  {
    id: "gmail",
    name: "Gmail / Google Workspace",
    imapHost: "imap.gmail.com", imapPort: 993, imapSecure: true,
    smtpHost: "smtp.gmail.com", smtpPort: 465, smtpSecure: true,
    appendSent: false, // Gmail saves SMTP-sent mail automatically
    help: "Turn on 2-Step Verification, then create an App Password at myaccount.google.com/apppasswords and use it as the password.",
  },
  {
    id: "outlook",
    name: "Outlook / Microsoft 365",
    imapHost: "outlook.office365.com", imapPort: 993, imapSecure: true,
    smtpHost: "smtp.office365.com", smtpPort: 587, smtpSecure: false,
    appendSent: false,
    help: "IMAP/SMTP AUTH must be enabled for the mailbox. Use an app password if MFA is on.",
  },
  {
    id: "zoho",
    name: "Zoho Mail",
    imapHost: "imap.zoho.com", imapPort: 993, imapSecure: true,
    smtpHost: "smtp.zoho.com", smtpPort: 465, smtpSecure: true,
    appendSent: true,
    help: "Enable IMAP in Zoho Mail settings. Use an app-specific password if 2FA is on. (India accounts: imap.zoho.in / smtp.zoho.in)",
  },
  {
    id: "yahoo",
    name: "Yahoo Mail",
    imapHost: "imap.mail.yahoo.com", imapPort: 993, imapSecure: true,
    smtpHost: "smtp.mail.yahoo.com", smtpPort: 465, smtpSecure: true,
    appendSent: true,
    help: "Generate an app password in Yahoo Account Security.",
  },
  {
    id: "hostinger",
    name: "Hostinger",
    imapHost: "imap.hostinger.com", imapPort: 993, imapSecure: true,
    smtpHost: "smtp.hostinger.com", smtpPort: 465, smtpSecure: true,
    appendSent: true,
    help: "Use your full email address and mailbox password.",
  },
  {
    id: "custom",
    name: "Other (custom IMAP/SMTP)",
    imapHost: "", imapPort: 993, imapSecure: true,
    smtpHost: "", smtpPort: 465, smtpSecure: true,
    appendSent: true,
    help: "Get the IMAP/SMTP server details from your email provider.",
  },
];
