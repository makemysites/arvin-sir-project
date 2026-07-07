import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

// Deletes an exam along with its questions and attempts.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ examId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { examId } = await params;
  if (!ObjectId.isValid(examId)) {
    return NextResponse.json({ error: "Exam not found" }, { status: 404 });
  }

  const db = await getDb();
  const examOid = new ObjectId(examId);
  await Promise.all([
    db.collection("exams").deleteOne({ _id: examOid }),
    db.collection("questions").deleteMany({ exam_id: examOid }),
    db.collection("attempts").deleteMany({ exam_id: examOid }),
  ]);
  return NextResponse.json({ ok: true });
}
