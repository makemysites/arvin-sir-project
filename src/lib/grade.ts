import { ObjectId, type Db } from "mongodb";
import type { OptionKey } from "@/lib/types";

// Grades an attempt from its saved answers and marks it submitted.
// Safe to call twice: a second call on a submitted attempt is a no-op.
export async function gradeAndSubmit(
  db: Db,
  attemptId: ObjectId,
  { autoSubmitted = false }: { autoSubmitted?: boolean } = {}
) {
  const attempts = db.collection("attempts");
  const attempt = await attempts.findOne({ _id: attemptId });
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.status === "submitted") return attempt;

  const questions = await db
    .collection("questions")
    .find({ exam_id: attempt.exam_id })
    .project({ correct: 1 })
    .toArray();

  const answers = (attempt.answers ?? {}) as Record<string, OptionKey>;
  const score = questions.reduce(
    (acc, q) => (answers[q._id.toString()] === q.correct ? acc + 1 : acc),
    0
  );

  const updated = await attempts.findOneAndUpdate(
    { _id: attemptId, status: "in_progress" }, // guards against double submission
    {
      $set: {
        status: "submitted",
        submitted_at: new Date(),
        score,
        total: questions.length,
        auto_submitted: autoSubmitted,
      },
    },
    { returnDocument: "after" }
  );
  // If another request submitted it in the same instant, return that result.
  return updated ?? (await attempts.findOne({ _id: attemptId }));
}
