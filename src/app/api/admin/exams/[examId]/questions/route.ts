import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

const OPTIONS = ["A", "B", "C", "D"];

// Replaces the exam's question set with the uploaded one.
// Only allowed while the exam is still a draft.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { examId } = await params;
  if (!ObjectId.isValid(examId)) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }
  const { questions } = await request.json();

  if (!Array.isArray(questions) || questions.length === 0 || questions.length > 500) {
    return NextResponse.json(
      { error: "Upload between 1 and 500 questions" },
      { status: 400 }
    );
  }

  const examOid = new ObjectId(examId);
  const rows = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const correct = String(q.correct ?? "").trim().toUpperCase();
    if (
      !q.question || !q.option_a || !q.option_b || !q.option_c || !q.option_d ||
      !OPTIONS.includes(correct)
    ) {
      return NextResponse.json(
        { error: `Row ${i + 1} is invalid: every column must be filled and the answer must be A, B, C or D` },
        { status: 400 }
      );
    }
    rows.push({
      exam_id: examOid,
      position: i + 1,
      question: String(q.question).trim(),
      option_a: String(q.option_a).trim(),
      option_b: String(q.option_b).trim(),
      option_c: String(q.option_c).trim(),
      option_d: String(q.option_d).trim(),
      correct,
      section: q.section ? String(q.section).trim().slice(0, 40) : null,
    });
  }

  const db = await getDb();
  const exam = await db.collection("exams").findOne({ _id: examOid });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  if (exam.status !== "draft") {
    return NextResponse.json(
      { error: "Questions can only be changed while the exam is a draft" },
      { status: 409 }
    );
  }

  await db.collection("questions").deleteMany({ exam_id: examOid });
  await db.collection("questions").insertMany(rows);
  return NextResponse.json({ ok: true, count: rows.length });
}
