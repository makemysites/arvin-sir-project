import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import { gradeAndSubmit } from "@/lib/grade";

// Moves an exam between draft -> live -> ended.
// Ending an exam auto-submits any attempts still in progress.
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
  const { status } = await request.json();
  if (!["draft", "live", "ended"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const db = await getDb();
  const examOid = new ObjectId(examId);
  const exam = await db.collection("exams").findOne({ _id: examOid });
  if (!exam) return NextResponse.json({ error: "Exam not found" }, { status: 404 });

  if (status === "live") {
    const count = await db.collection("questions").countDocuments({ exam_id: examOid });
    if (!count) {
      return NextResponse.json(
        { error: "Upload questions before starting the exam" },
        { status: 400 }
      );
    }
  }

  const patch: Record<string, unknown> = { status };
  if (status === "live" && exam.status === "draft") patch.started_at = new Date();
  if (status === "ended") patch.ended_at = new Date();
  await db.collection("exams").updateOne({ _id: examOid }, { $set: patch });

  if (status === "ended") {
    const open = await db
      .collection("attempts")
      .find({ exam_id: examOid, status: "in_progress" })
      .project({ _id: 1 })
      .toArray();
    for (const attempt of open) {
      try {
        await gradeAndSubmit(db, attempt._id, { autoSubmitted: true });
      } catch {
        // keep going; remaining attempts should still be closed
      }
    }
  }

  return NextResponse.json({ ok: true });
}
