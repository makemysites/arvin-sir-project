import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

const COOKIE_NAME = "exam_session";
const SESSION_DAYS = 7;

export interface SessionUser {
  id: string; // users._id as hex string
  email: string;
}

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

// Called after a successful OTP verification (route handler context).
export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret());

  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { id: payload.sub, email: payload.email };
  } catch {
    return null; // expired or tampered token
  }
}

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

// Super admin can never be removed.
export const SUPER_ADMIN_EMAIL = "tippaniabhinay@gmail.com";

export function isSuperAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

// Checks env-based admins AND database admins.
export async function checkIsAdmin(email: string | undefined | null): Promise<boolean> {
  if (!email) return false;
  if (isAdminEmail(email)) return true;
  if (isSuperAdmin(email)) return true;
  const db = await getDb();
  const doc = await db.collection("admins").findOne({ email: email.toLowerCase() });
  return !!doc;
}

// Returns all admin emails (env + database) for bulk filtering.
export async function getAllAdminEmails(): Promise<Set<string>> {
  const envAdmins = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (!envAdmins.includes(SUPER_ADMIN_EMAIL.toLowerCase())) {
    envAdmins.push(SUPER_ADMIN_EMAIL.toLowerCase());
  }
  const db = await getDb();
  const dbAdmins = await db.collection("admins").find({}).project({ email: 1 }).toArray();
  return new Set([...envAdmins, ...dbAdmins.map((a) => (a.email as string).toLowerCase())]);
}
