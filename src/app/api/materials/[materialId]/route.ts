import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Streams a study material to any signed-in user.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { materialId } = await params;
  if (!ObjectId.isValid(materialId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await getDb();
  const oid = new ObjectId(materialId);
  const fileDoc = await db.collection("materials.files").findOne({ _id: oid });
  if (!fileDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = new GridFSBucket(db, { bucketName: "materials" });
  const stream = bucket.openDownloadStream(oid);

  // ASCII-safe filename for the header.
  const safeName = String(fileDoc.filename ?? "material")
    .replace(/[^\x20-\x7E]/g, "_")
    .replace(/"/g, "'");

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": fileDoc.metadata?.content_type ?? "application/octet-stream",
      "Content-Length": String(fileDoc.length),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
