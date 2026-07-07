import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { gradeAndSubmit } from "@/lib/grade";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { attemptId } = await request.json();
  if (typeof attemptId !== "string" || !ObjectId.isValid(attemptId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const db = await getDb();
  const attemptOid = new ObjectId(attemptId);
  const attempt = await db.collection("attempts").findOne({ _id: attemptOid });
  if (!attempt || attempt.student_id.toString() !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const result = await gradeAndSubmit(db, attemptOid);
    return NextResponse.json({
      ok: true,
      score: result?.score ?? null,
      total: result?.total ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Submission failed" }, { status: 500 });
  }
}
