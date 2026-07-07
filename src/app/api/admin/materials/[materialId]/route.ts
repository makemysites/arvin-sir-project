import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { materialId } = await params;
  if (!ObjectId.isValid(materialId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "materials" });
  try {
    await bucket.delete(new ObjectId(materialId));
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
