import { NextResponse } from "next/server";
import { GridFSBucket } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";

// Vercel serverless caps request bodies at ~4.5 MB, so we stop a bit under it.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large — max 4 MB. For bigger files, share a Google Drive link with students instead." },
      { status: 400 }
    );
  }

  const title = String(form.get("title") ?? "").trim().slice(0, 120) || file.name;

  const db = await getDb();
  const bucket = new GridFSBucket(db, { bucketName: "materials" });
  const buffer = Buffer.from(await file.arrayBuffer());

  await new Promise<void>((resolve, reject) => {
    const upload = bucket.openUploadStream(file.name, {
      metadata: {
        title,
        content_type: file.type || "application/octet-stream",
      },
    });
    upload.on("finish", () => resolve());
    upload.on("error", reject);
    upload.end(buffer);
  });

  return NextResponse.json({ ok: true });
}
