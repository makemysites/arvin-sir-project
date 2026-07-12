import { NextResponse } from "next/server";
import { GridFSBucket, ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

// Vercel serverless caps request bodies at ~4.5 MB; the editor compresses
// images in the browser first, so uploads land well under this.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// Stores an explanation image and returns its id. The image is linked to a
// question either by the bulk question save (draft) or the per-question
// PATCH (live/ended). Unreferenced images are cleaned up on the next save.
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

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose an image" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image too large — max 4 MB" }, { status: 400 });
  }

  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "explanations" });
  const buffer = Buffer.from(await file.arrayBuffer());

  const imageId = await new Promise<ObjectId>((resolve, reject) => {
    const upload = bucket.openUploadStream(file.name || "explanation.jpg", {
      metadata: {
        exam_id: new ObjectId(examId),
        content_type: file.type,
      },
    });
    upload.on("finish", () => resolve(upload.id as ObjectId));
    upload.on("error", reject);
    upload.end(buffer);
  });

  return NextResponse.json({ imageId: imageId.toString() });
}
