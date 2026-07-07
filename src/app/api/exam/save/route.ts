import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

const OPTIONS = ["A", "B", "C", "D"];
const GRACE_MS = 15_000;

// Saves a single answer selection. Rejected after the deadline.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId, questionId, selected } = await request.json();
  if (
    typeof attemptId !== "string" || !ObjectId.isValid(attemptId) ||
    typeof questionId !== "string" || !ObjectId.isValid(questionId) ||
    !OPTIONS.includes(selected)
  ) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await getDb();
  const attempt = await db.collection("attempts").findOne({ _id: new ObjectId(attemptId) });

  if (!attempt || attempt.student_id.toString() !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (attempt.status !== "in_progress") {
    return NextResponse.json({ error: "Already submitted" }, { status: 409 });
  }
  if (Date.now() > new Date(attempt.deadline).getTime() + GRACE_MS) {
    return NextResponse.json({ error: "Time is up" }, { status: 403 });
  }

  await db.collection("attempts").updateOne(
    { _id: attempt._id, status: "in_progress" },
    { $set: { [`answers.${questionId}`]: selected } }
  );
  return NextResponse.json({ ok: true });
}
