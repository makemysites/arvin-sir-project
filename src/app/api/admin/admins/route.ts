import { NextResponse } from "next/server";
import { getUser, checkIsAdmin, isAdminEmail, isSuperAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

const SUPER_ADMIN = "tippaniabhinay@gmail.com";

// List all admins (env + database).
export async function GET() {
  const user = await getUser();
  if (!user || !(await checkIsAdmin(user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const dbAdmins = await db
    .collection("admins")
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  // Collect env-based admins.
  const envEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  // Ensure super admin is always listed.
  if (!envEmails.includes(SUPER_ADMIN.toLowerCase())) {
    envEmails.unshift(SUPER_ADMIN.toLowerCase());
  }

  const seen = new Set<string>();
  const admins: {
    email: string;
    source: "env" | "database";
    isSuperAdmin: boolean;
    addedBy?: string;
    createdAt?: string;
  }[] = [];

  for (const email of envEmails) {
    seen.add(email);
    admins.push({
      email,
      source: "env",
      isSuperAdmin: isSuperAdmin(email),
    });
  }

  for (const doc of dbAdmins) {
    const email = (doc.email as string).toLowerCase();
    if (!seen.has(email)) {
      seen.add(email);
      admins.push({
        email,
        source: "database",
        isSuperAdmin: false,
        addedBy: doc.added_by as string | undefined,
        createdAt: doc.created_at ? new Date(doc.created_at).toISOString() : undefined,
      });
    }
  }

  return NextResponse.json({ admins });
}

// Add a new admin.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user || !(await checkIsAdmin(user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (typeof email !== "string" || !email.includes("@") || email.trim().length < 5) {
    return NextResponse.json({ error: "Please enter a valid email address" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (await checkIsAdmin(normalizedEmail)) {
    return NextResponse.json({ error: "This email is already an admin" }, { status: 409 });
  }

  const db = await getDb();
  try {
    await db.collection("admins").insertOne({
      email: normalizedEmail,
      added_by: user.email,
      created_at: new Date(),
    });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && err.code === 11000) {
      return NextResponse.json({ error: "This email is already an admin" }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true });
}

// Remove an admin.
export async function DELETE(request: Request) {
  const user = await getUser();
  if (!user || !(await checkIsAdmin(user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { email } = await request.json();
  if (typeof email !== "string") {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const normalizedEmail = email.trim().toLowerCase();

  if (isSuperAdmin(normalizedEmail)) {
    return NextResponse.json(
      { error: "The super admin cannot be removed" },
      { status: 403 }
    );
  }

  // Env-based admins can't be removed from the UI.
  if (isAdminEmail(normalizedEmail)) {
    return NextResponse.json(
      { error: "This admin is set in the server environment and cannot be removed from here" },
      { status: 403 }
    );
  }

  const db = await getDb();
  const result = await db.collection("admins").deleteOne({ email: normalizedEmail });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
