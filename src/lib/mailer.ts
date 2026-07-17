import nodemailer from "nodemailer";

interface SmtpConfig {
  label: string;
  host?: string;
  port: number;
  user?: string;
  pass?: string;
  fromEmail?: string;
  fromName: string;
}

// Primary sender (Brevo) plus an optional fallback (e.g. Gmail app password).
// If the primary fails — daily quota hit, IP blocked, outage — the fallback
// takes over automatically, so exam day doesn't depend on one provider.
function smtpConfigs(): SmtpConfig[] {
  const configs: SmtpConfig[] = [];
  if (process.env.SMTP_USER) {
    configs.push({
      label: "primary",
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
      fromEmail: process.env.SMTP_FROM_EMAIL,
      fromName: process.env.SMTP_FROM_NAME ?? "Exam Portal",
    });
  }
  if (process.env.SMTP2_USER) {
    configs.push({
      label: "fallback",
      host: process.env.SMTP2_HOST,
      port: Number(process.env.SMTP2_PORT ?? 587),
      user: process.env.SMTP2_USER,
      pass: process.env.SMTP2_PASS,
      // Gmail ignores custom from addresses, so default to the account itself.
      fromEmail: process.env.SMTP2_FROM_EMAIL ?? process.env.SMTP2_USER,
      fromName: process.env.SMTP2_FROM_NAME ?? process.env.SMTP_FROM_NAME ?? "Exam Portal",
    });
  }
  return configs;
}

export async function sendOtpEmail(to: string, code: string) {
  const configs = smtpConfigs();

  // Local development without SMTP configured: print the code instead.
  if (process.env.NODE_ENV !== "production" && configs.length === 0) {
    console.log(`[dev] OTP for ${to}: ${code}`);
    return;
  }
  if (configs.length === 0) throw new Error("No SMTP configured");

  const message = {
    to,
    subject: `${code} is your login code`,
    text: `Your login code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto">
        <h2 style="color:#1e293b">Your login code</h2>
        <p style="color:#475569">Enter this code to sign in to the Aptitude Exam Portal:</p>
        <p style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#4f46e5;text-align:center;margin:24px 0">${code}</p>
        <p style="color:#94a3b8;font-size:13px">This code expires in 10 minutes. If you didn't request it, you can ignore this email.</p>
      </div>`,
  };

  let lastError: unknown;
  for (const config of configs) {
    try {
      const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
        connectionTimeout: 10_000,
      });
      await transport.sendMail({
        ...message,
        from: `"${config.fromName}" <${config.fromEmail}>`,
      });
      return;
    } catch (err) {
      console.error(`OTP send via ${config.label} SMTP failed:`, err);
      lastError = err;
    }
  }
  throw lastError;
}
