import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

// Attaches (or removes) an explanation image on a saved question.
// Allowed in ANY exam status — explanations don't affect grading, and the
// teacher often adds them after the exam ends.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ questionId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { questionId } = await params;
  if (!ObjectId.isValid(questionId)) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }
  const { imageId } = await request.json();
  if (imageId !== null && (typeof imageId !== "string" || !ObjectId.isValid(imageId))) {
    return NextResponse.json({ error: "Invalid image" }, { status: 400 });
  }

  const db = await getDb();
  const questionOid = new ObjectId(questionId);
  const question = await db.collection("questions").findOne({ _id: questionOid });
  if (!question) return NextResponse.json({ error: "Question not found" }, { status: 404 });

  const newId = imageId ? new ObjectId(imageId) : null;
  await db
    .collection("questions")
    .updateOne({ _id: questionOid }, { $set: { explanation_image_id: newId } });

  // Drop the image being replaced/removed so the database doesn't fill up.
  const oldId = question.explanation_image_id as ObjectId | null | undefined;
  if (oldId && (!newId || !oldId.equals(newId))) {
    const bucket = new GridFSBucket(db, { bucketName: "explanations" });
    await bucket.delete(oldId).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
