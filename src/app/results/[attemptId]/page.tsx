import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import ReviewForm from "@/components/ReviewForm";
import type { OptionKey } from "@/lib/types";

export const dynamic = "force-dynamic";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

function ScoreRing({ score, total }: { score: number; total: number }) {
  const pct = total > 0 ? score / total : 0;
  const r = 54;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-40 w-40 mx-auto">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#EEF1F8" strokeWidth="11" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="url(#ring)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="128" y2="128">
            <stop stopColor="#6366F1" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-4xl font-extrabold text-ink leading-none">
          {score}
        </span>
        <span className="text-sm text-muted mt-1">of {total}</span>
      </div>
    </div>
  );
}

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

  const isOwnAttempt = attempt.student_id.toString() === user.id;
  const [exam, student, viewer, myReview] = await Promise.all([
    db.collection("exams").findOne({ _id: attempt.exam_id }),
    db.collection("users").findOne({ _id: attempt.student_id }),
    db.collection("users").findOne({ _id: new ObjectId(user.id) }),
    isOwnAttempt
      ? db.collection("reviews").findOne({
          exam_id: attempt.exam_id,
          student_id: attempt.student_id,
        })
      : Promise.resolve(null),
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
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-10">
        <div className="card p-8 text-center mb-8 fade-up">
          <p className="pill bg-indigo-50 text-primary mb-2">{exam.title}</p>
          {admin && (
            <p className="text-sm text-muted mb-4">
              {student?.full_name} · {student?.email}
            </p>
          )}
          <div className="my-6">
            <ScoreRing score={attempt.score ?? 0} total={attempt.total ?? 0} />
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            {attempt.violations > 0 && (
              <span className="pill bg-amber-50 text-amber-700">
                ⚠ {attempt.violations} violation{attempt.violations > 1 ? "s" : ""}
              </span>
            )}
            {attempt.auto_submitted && (
              <span className="pill bg-red-50 text-danger">Auto-submitted</span>
            )}
          </div>
        </div>

        {isOwnAttempt && (
          <ReviewForm
            examId={exam._id.toString()}
            initialRating={myReview?.rating ?? null}
            initialComment={myReview?.comment ?? ""}
          />
        )}

        {!canReview ? (
          <div className="card p-8 text-center fade-up">
            <div className="mx-auto h-12 w-12 rounded-xl bg-slate-50 border border-line flex items-center justify-center text-xl mb-3">
              🔒
            </div>
            <p className="font-semibold text-ink">Answer review is locked</p>
            <p className="text-sm text-muted mt-1">
              It unlocks for everyone once your teacher ends the exam.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {questions.map((q, i) => {
              const qid = q._id.toString();
              const chosen = answers[qid];
              const isCorrect = chosen === q.correct;
              return (
                <div key={qid} className="card p-6 fade-up">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <p className="font-semibold text-ink leading-relaxed whitespace-pre-wrap">
                      <span className="text-muted mr-1.5">{i + 1}.</span>
                      {q.question}
                      {q.section && (
                        <span className="pill bg-violet-50 text-violet-700 ml-2 align-middle">
                          {q.section}
                        </span>
                      )}
                    </p>
                    <span
                      className={`pill shrink-0 ${
                        !chosen
                          ? "bg-slate-100 text-muted"
                          : isCorrect
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-red-50 text-danger"
                      }`}
                    >
                      {!chosen ? "Skipped" : isCorrect ? "✓ Correct" : "✗ Wrong"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {OPTION_KEYS.map((key) => {
                      const text = q[`option_${key.toLowerCase()}`] as string;
                      const isAnswer = q.correct === key;
                      const isChosen = chosen === key;
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border px-4 py-2.5 text-sm flex items-center gap-3 ${
                            isAnswer
                              ? "border-emerald-300 bg-emerald-50/70"
                              : isChosen
                                ? "border-red-200 bg-red-50/70"
                                : "border-line"
                          }`}
                        >
                          <span
                            className={`shrink-0 w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                              isAnswer
                                ? "bg-emerald-600 text-white"
                                : isChosen
                                  ? "bg-red-500 text-white"
                                  : "bg-slate-100 text-muted"
                            }`}
                          >
                            {key}
                          </span>
                          <span className="text-ink flex-1">{text}</span>
                          {isAnswer && (
                            <span className="text-xs font-semibold text-emerald-700">
                              {isChosen ? "✓ Your answer" : "Correct answer"}
                            </span>
                          )}
                          {isChosen && !isAnswer && (
                            <span className="text-xs font-semibold text-danger">Your answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation_image_id && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                        📝 Teacher&apos;s explanation
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/explanations/${q.explanation_image_id.toString()}`}
                        alt={`Explanation for question ${i + 1}`}
                        loading="lazy"
                        className="rounded-xl border border-line max-h-[28rem] w-auto"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="text-center mt-10">
          <Link
            href={admin ? `/admin/exam/${exam._id.toString()}` : "/dashboard"}
            className="btn btn-outline"
          >
            ← Back
          </Link>
        </div>
      </main>
    </>
  );
}
