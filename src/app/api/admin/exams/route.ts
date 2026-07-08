import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { EXAM_CATEGORIES } from "@/lib/types";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { title, duration_minutes, category } = await request.json();
  const duration = Number(duration_minutes);
  if (
    typeof title !== "string" ||
    title.trim().length < 2 ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 600 ||
    !EXAM_CATEGORIES.includes(category)
  ) {
    return NextResponse.json({ error: "Invalid title, duration or category" }, { status: 400 });
  }

  const db = await getDb();
  const { insertedId } = await db.collection("exams").insertOne({
    title: title.trim(),
    duration_minutes: duration,
    category,
    status: "draft",
    created_at: new Date(),
    started_at: null,
    ended_at: null,
  });
  return NextResponse.json({ exam: { id: insertedId.toString() } });
}
