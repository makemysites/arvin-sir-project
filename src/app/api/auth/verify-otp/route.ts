import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { hashOtp } from "@/lib/otp";

const MAX_TRIES = 5;

export async function POST(request: Request) {
  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const code = String(body.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const db = await getDb();
  const otp = await db
    .collection("otps")
    .findOneAndUpdate({ email }, { $inc: { tries: 1 } }, { returnDocument: "after" });

  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Code expired — request a new one" },
      { status: 400 }
    );
  }
  if (otp.tries > MAX_TRIES) {
    return NextResponse.json(
      { error: "Too many wrong attempts — request a new code" },
      { status: 429 }
    );
  }

  const expected = Buffer.from(otp.code_hash, "hex");
  const actual = Buffer.from(hashOtp(code, email), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return NextResponse.json({ error: "Wrong code — check and try again" }, { status: 400 });
  }

  // Code is valid: consume it and sign the user in (creating them if new).
  await db.collection("otps").deleteOne({ email });
  const user = await db.collection("users").findOneAndUpdate(
    { email },
    { $setOnInsert: { email, full_name: null, created_at: new Date() } },
    { upsert: true, returnDocument: "after" }
  );
  if (!user) {
    return NextResponse.json({ error: "Could not sign you in" }, { status: 500 });
  }

  await createSession({ id: user._id.toString(), email });
  // Tells the login page to collect the student's name right after signup.
  return NextResponse.json({ ok: true, needsName: !user.full_name });
}
