import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import type { OptionKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  if (!ObjectId.isValid(attemptId)) notFound();

  const user = await getUser();
  if (!user) redirect("/login");
  const admin = isAdminEmail(user.email);

  const db = await getDb();
  const attempt = await db
    .collection("attempts")
    .findOne({ _id: new ObjectId(attemptId) });

  if (!attempt) notFound();
  if (!admin && attempt.student_id.toString() !== user.id) notFound();
  if (attempt.status !== "submitted") redirect(`/exam/${attempt.exam_id.toString()}`);

  const [exam, student, viewer] = await Promise.all([
    db.collection("exams").findOne({ _id: attempt.exam_id }),
    db.collection("users").findOne({ _id: attempt.student_id }),
    db.collection("users").findOne({ _id: new ObjectId(user.id) }),
  ]);
  if (!exam) notFound();

  const examEnded = exam.status === "ended";
  const canReview = admin || examEnded;

  const questions = canReview
    ? await db
        .collection("questions")
        .find({ exam_id: attempt.exam_id })
        .sort({ position: 1 })
        .toArray()
    : [];

  const answers = (attempt.answers ?? {}) as Record<string, OptionKey>;

  return (
    <>
      <Header name={viewer?.full_name ?? user.email} isAdmin={admin} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center mb-6">
          <h1 className="text-lg font-bold text-slate-900">{exam.title}</h1>
          {admin && (
            <p className="text-sm text-slate-500">
              {student?.full_name} ({student?.email})
            </p>
          )}
          <p className="text-5xl font-bold text-indigo-600 my-4">
            {attempt.score}
            <span className="text-slate-400 text-3xl">/{attempt.total}</span>
          </p>
          <div className="text-sm text-slate-500 space-x-3">
            {attempt.violations > 0 && (
              <span className="text-amber-600">⚠ {attempt.violations} violation{attempt.violations > 1 ? "s" : ""}</span>
            )}
            {attempt.auto_submitted && <span className="text-red-500">Auto-submitted</span>}
          </div>
        </div>

        {!canReview ? (
          <p className="text-center text-sm text-slate-500 bg-white border border-slate-200 rounded-xl p-6">
            The detailed answer review will appear here once your teacher ends the exam.
          </p>
        ) : (
          <div className="space-y-4">
            {questions.map((q, i) => {
              const qid = q._id.toString();
              const chosen = answers[qid];
              const isCorrect = chosen === q.correct;
              return (
                <div key={qid} className="bg-white border border-slate-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <p className="font-medium text-slate-900 whitespace-pre-wrap">
                      {i + 1}. {q.question}
                    </p>
                    <span
                      className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                        !chosen
                          ? "bg-slate-100 text-slate-500"
                          : isCorrect
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {!chosen ? "Not answered" : isCorrect ? "Correct" : "Wrong"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {OPTION_KEYS.map((key) => {
                      const text = q[`option_${key.toLowerCase()}`] as string;
                      const isAnswer = q.correct === key;
                      const isChosen = chosen === key;
                      return (
                        <div
                          key={key}
                          className={`rounded-lg border px-3 py-2 text-sm flex items-center gap-2 ${
                            isAnswer
                              ? "border-emerald-400 bg-emerald-50"
                              : isChosen
                                ? "border-red-300 bg-red-50"
                                : "border-slate-100"
                          }`}
                        >
                          <span className="font-semibold text-slate-600 w-4">{key}.</span>
                          <span className="text-slate-800 flex-1">{text}</span>
                          {isAnswer && <span className="text-xs font-semibold text-emerald-600">Correct answer</span>}
                          {isChosen && !isAnswer && <span className="text-xs font-semibold text-red-500">Your answer</span>}
                          {isChosen && isAnswer && <span className="text-xs font-semibold text-emerald-600">✓ Your answer</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-8">
          <Link
            href={admin ? `/admin/exam/${exam._id.toString()}` : "/dashboard"}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Back
          </Link>
        </div>
      </main>
    </>
  );
}
