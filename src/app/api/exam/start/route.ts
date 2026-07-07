import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Starts (or resumes) the caller's attempt for a live exam.
// Returns the questions WITHOUT the correct answers, plus the
// server-computed deadline and any answers already saved.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { examId } = await request.json();
  if (typeof examId !== "string" || !ObjectId.isValid(examId)) {
    return NextResponse.json({ error: "Missing examId" }, { status: 400 });
  }

  const db = await getDb();
  const examOid = new ObjectId(examId);
  const studentOid = new ObjectId(user.id);

  const exam = await db.collection("exams").findOne({ _id: examOid });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (exam.status !== "live") {
    return NextResponse.json({ error: "This exam is not live" }, { status: 403 });
  }

  // Students must have a name before writing (it appears on the leaderboard).
  const student = await db.collection("users").findOne({ _id: studentOid });
  if (!student?.full_name) {
    return NextResponse.json(
      { error: "Please set your name before starting the exam" },
      { status: 428 }
    );
  }

  const attempts = db.collection("attempts");
  let attempt = await attempts.findOne({ exam_id: examOid, student_id: studentOid });

  if (attempt?.status === "submitted") {
    return NextResponse.json(
      { error: "You have already submitted this exam", attemptId: attempt._id.toString() },
      { status: 409 }
    );
  }

  if (!attempt) {
    const now = new Date();
    try {
      const { insertedId } = await attempts.insertOne({
        exam_id: examOid,
        student_id: studentOid,
        started_at: now,
        deadline: new Date(now.getTime() + exam.duration_minutes * 60_000),
        submitted_at: null,
        status: "in_progress",
        answers: {},
        score: null,
        total: null,
        violations: 0,
        auto_submitted: false,
      });
      attempt = await attempts.findOne({ _id: insertedId });
    } catch {
      // Unique index race: another tab created it — use that one.
      attempt = await attempts.findOne({ exam_id: examOid, student_id: studentOid });
    }
  }
  if (!attempt) {
    return NextResponse.json({ error: "Could not start attempt" }, { status: 500 });
  }

  const questions = await db
    .collection("questions")
    .find({ exam_id: examOid })
    .project({ correct: 0, exam_id: 0 })
    .sort({ position: 1 })
    .toArray();

  return NextResponse.json({
    attemptId: attempt._id.toString(),
    examTitle: exam.title,
    deadline: new Date(attempt.deadline).toISOString(),
    serverNow: new Date().toISOString(),
    violations: attempt.violations,
    savedAnswers: attempt.answers ?? {},
    questions: questions.map((q) => ({
      id: q._id.toString(),
      position: q.position,
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      section: q.section ?? null,
    })),
  });
}
