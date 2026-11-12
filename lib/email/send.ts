import nodemailer from "nodemailer";

export interface EmailMessage {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  text: string;
}

export interface SendOpts {
  provider?: "gmail" | "resend";
  from?: string;
  gmail?: { sendMail: (m: Record<string, unknown>) => Promise<unknown> };
  resendKey?: string;
  fetchImpl?: typeof fetch;
}

/**
 * Gmail SMTP until there's a sending domain (Resend's test sender can only mail the account owner),
 * then Resend — switched by EMAIL_PROVIDER, no code change.
 */
export async function sendEmail(msg: EmailMessage, opts: SendOpts = {}): Promise<void> {
  const provider = opts.provider ?? ((process.env.EMAIL_PROVIDER as "gmail" | "resend") || "gmail");
  if (provider === "resend") {
    const key = opts.resendKey ?? process.env.RESEND_API_KEY;
    const from = opts.from ?? process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
    const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: msg.to, cc: msg.cc, subject: msg.subject, html: msg.html, text: msg.text }),
    });
    if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text().catch(() => "")}`);
    return;
  }
  const user = process.env.GMAIL_USER;
  const from = opts.from ?? (process.env.EMAIL_FROM || user);
  const transport =
    opts.gmail ??
    (() => {
      if (!user || !process.env.GMAIL_APP_PASSWORD) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set");
      return nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user, pass: process.env.GMAIL_APP_PASSWORD },
      });
    })();
  await transport.sendMail({
    from: `Event Finder <${from}>`,
    to: msg.to.join(", "),
    cc: msg.cc.join(", "),
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  });
}
