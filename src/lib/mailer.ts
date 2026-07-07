import nodemailer from "nodemailer";

export async function sendOtpEmail(to: string, code: string) {
  // Local development without SMTP configured: print the code instead.
  if (process.env.NODE_ENV !== "production" && !process.env.SMTP_USER) {
    console.log(`[dev] OTP for ${to}: ${code}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: `"${process.env.SMTP_FROM_NAME ?? "Exam Portal"}" <${process.env.SMTP_FROM_EMAIL}>`,
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
  });
}
