import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Students leave one review per exam, editable any time after submitting.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId, rating, comment } = await request.json();
  const stars = Number(rating);
  if (
    typeof examId !== "string" ||
    !ObjectId.isValid(examId) ||
    !Number.isInteger(stars) ||
    stars < 1 ||
    stars > 5 ||
    typeof comment !== "string" ||
    comment.length > 2000
  ) {
    return NextResponse.json({ error: "Invalid review" }, { status: 400 });
  }

  const db = await getDb();
  const examOid = new ObjectId(examId);
  const studentOid = new ObjectId(user.id);

  // Only students who actually finished the exam can review it.
  const attempt = await db.collection("attempts").findOne({
    exam_id: examOid,
    student_id: studentOid,
    status: "submitted",
  });
  if (!attempt) {
    return NextResponse.json(
      { error: "Submit the exam before leaving a review" },
      { status: 403 }
    );
  }

  await db.collection("reviews").updateOne(
    { exam_id: examOid, student_id: studentOid },
    {
      $set: { rating: stars, comment: comment.trim(), updated_at: new Date() },
      $setOnInsert: { created_at: new Date() },
    },
    { upsert: true }
  );
  return NextResponse.json({ ok: true });
}
