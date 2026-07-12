import { type NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser, checkIsAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Students report issues during or after an exam.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId, attemptId, category, description } = await request.json();

  if (
    typeof examId !== "string" ||
    !ObjectId.isValid(examId) ||
    typeof attemptId !== "string" ||
    !ObjectId.isValid(attemptId) ||
    typeof category !== "string" ||
    category.length === 0 ||
    category.length > 100 ||
    typeof description !== "string" ||
    description.length < 3 ||
    description.length > 1000
  ) {
    return NextResponse.json({ error: "Invalid issue report" }, { status: 400 });
  }

  const db = await getDb();
  const attemptOid = new ObjectId(attemptId);

  // Verify this attempt belongs to the student.
  const attempt = await db.collection("attempts").findOne({
    _id: attemptOid,
    student_id: new ObjectId(user.id),
  });
  if (!attempt) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  await db.collection("issues").insertOne({
    exam_id: new ObjectId(examId),
    attempt_id: attemptOid,
    student_id: new ObjectId(user.id),
    category,
    description: description.trim(),
    status: "open",
    created_at: new Date(),
  });

  return NextResponse.json({ ok: true });
}

// Admin fetches issues for a specific exam.
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user || !(await checkIsAdmin(user.email))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const examId = request.nextUrl.searchParams.get("examId");
  if (!examId || !ObjectId.isValid(examId)) {
    return NextResponse.json({ error: "Missing examId" }, { status: 400 });
  }

  const db = await getDb();
  const issues = await db
    .collection("issues")
    .find({ exam_id: new ObjectId(examId) })
    .sort({ created_at: -1 })
    .toArray();

  const serialized = issues.map((i) => ({
    id: i._id.toString(),
    studentId: i.student_id.toString(),
    attemptId: i.attempt_id.toString(),
    category: i.category,
    description: i.description,
    status: i.status,
    createdAt: new Date(i.created_at).toISOString(),
  }));

  return NextResponse.json({ issues: serialized });
}
