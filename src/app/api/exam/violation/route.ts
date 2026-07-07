import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { gradeAndSubmit } from "@/lib/grade";
import { MAX_VIOLATIONS } from "@/lib/types";

// Records a proctoring violation (tab switch / fullscreen exit).
// Once the limit is crossed the attempt is auto-submitted server-side.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await request.json();
  if (typeof attemptId !== "string" || !ObjectId.isValid(attemptId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await getDb();
  const attemptOid = new ObjectId(attemptId);
  const existing = await db.collection("attempts").findOne({ _id: attemptOid });

  if (!existing || existing.student_id.toString() !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.status !== "in_progress") {
    return NextResponse.json({ violations: existing.violations, autoSubmitted: false });
  }

  const updated = await db.collection("attempts").findOneAndUpdate(
    { _id: attemptOid, status: "in_progress" },
    { $inc: { violations: 1 } },
    { returnDocument: "after" }
  );
  const violations = updated?.violations ?? existing.violations + 1;

  if (violations > MAX_VIOLATIONS) {
    await gradeAndSubmit(db, attemptOid, { autoSubmitted: true });
    return NextResponse.json({ violations, autoSubmitted: true });
  }
  return NextResponse.json({ violations, autoSubmitted: false });
}
