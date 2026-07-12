import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { Readable } from "stream";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Serves an explanation image to any signed-in user (shown in answer review).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ imageId: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { imageId } = await params;
  if (!ObjectId.isValid(imageId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = await getDb();
  const oid = new ObjectId(imageId);
  const fileDoc = await db.collection("explanations.files").findOne({ _id: oid });
  if (!fileDoc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const bucket = new GridFSBucket(db, { bucketName: "explanations" });
  const stream = bucket.openDownloadStream(oid);

  return new NextResponse(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": fileDoc.metadata?.content_type ?? "image/jpeg",
      "Content-Length": String(fileDoc.length),
      "Cache-Control": "private, max-age=86400",
    },
  });
}
