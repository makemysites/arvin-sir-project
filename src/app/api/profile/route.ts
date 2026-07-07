import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { full_name } = await request.json();
  if (typeof full_name !== "string" || full_name.trim().length < 2 || full_name.length > 80) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  const db = await getDb();
  await db
    .collection("users")
    .updateOne({ _id: new ObjectId(user.id) }, { $set: { full_name: full_name.trim() } });
  return NextResponse.json({ ok: true });
}
