import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { getDb } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mailer";
import { hashOtp } from "@/lib/otp";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

export async function POST(request: Request) {
  const { email: raw } = await request.json();
  const email = String(raw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  }

  const db = await getDb();
  const otps = db.collection("otps");

  const existing = await otps.findOne({ email });
  if (
    existing?.last_sent_at &&
    Date.now() - new Date(existing.last_sent_at).getTime() < RESEND_COOLDOWN_MS
  ) {
    return NextResponse.json(
      { error: "Please wait a minute before requesting another code" },
      { status: 429 }
    );
  }

  const code = randomInt(100000, 1000000).toString();
  const now = new Date();
  await otps.updateOne(
    { email },
    {
      $set: {
        code_hash: hashOtp(code, email),
        expires_at: new Date(now.getTime() + OTP_TTL_MS),
        last_sent_at: now,
        tries: 0,
      },
    },
    { upsert: true }
  );

  try {
    await sendOtpEmail(email, code);
  } catch (err) {
    console.error("OTP email failed:", err);
    return NextResponse.json(
      { error: "Could not send the email. Please try again in a moment." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
