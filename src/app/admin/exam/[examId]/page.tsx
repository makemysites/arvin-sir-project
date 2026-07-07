import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ObjectId } from "mongodb";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import QuestionUpload from "@/components/admin/QuestionUpload";
import QuestionEditor from "@/components/admin/QuestionEditor";
import StatusControls from "@/components/admin/StatusControls";
import DownloadCsvButton from "@/components/admin/DownloadCsvButton";
import type { ExamStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, string> = {
  draft: "bg-slate-100 text-muted",
  live: "bg-emerald-50 text-emerald-700",
  ended: "bg-ink text-white",
};

export default async function AdminExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const { examId } = await params;
  if (!ObjectId.isValid(examId)) notFound();
  const examOid = new ObjectId(examId);

  const db = await getDb();
  const [exam, questionDocs, attempts] = await Promise.all([
    db.collection("exams").findOne({ _id: examOid }),
    db
      .collection("questions")
      .find({ exam_id: examOid })
      .sort({ position: 1 })
      .toArray(),
    db
      .collection("attempts")
      .find({ exam_id: examOid })
      .sort({ score: -1 })
      .toArray(),
  ]);

  if (!exam) notFound();

  const questionCount = questionDocs.length;
  // Plain objects for the client-side editor.
  const editorRows = questionDocs.map((q) => ({
    question: q.question as string,
    option_a: q.option_a as string,
    option_b: q.option_b as string,
    option_c: q.option_c as string,
    option_d: q.option_d as string,
    correct: q.correct as string,
  }));

  const studentIds = attempts.map((a) => a.student_id);
  const students = studentIds.length
    ? await db.collection("users").find({ _id: { $in: studentIds } }).toArray()
    : [];
  const studentById = new Map(students.map((s) => [s._id.toString(), s]));

  const submitted = attempts.filter((r) => r.status === "submitted");
  const inProgress = attempts.filter((r) => r.status === "in_progress");
  const avg =
    submitted.length > 0
      ? (
          submitted.reduce((acc, r) => acc + (r.score ?? 0), 0) / submitted.length
        ).toFixed(1)
      : "—";

  const csvRows = submitted.map((r) => {
    const s = studentById.get(r.student_id.toString());
    return {
      name: s?.full_name ?? "",
      email: s?.email ?? "",
      score: r.score as number | null,
      total: r.total as number | null,
      violations: r.violations as number,
      autoSubmitted: Boolean(r.auto_submitted),
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toISOString() : null,
    };
  });

  const stats = [
    { label: "Questions", value: questionCount, icon: "❓" },
    { label: "Duration", value: `${exam.duration_minutes}m`, icon: "⏱" },
    { label: "Submitted", value: submitted.length, icon: "✅" },
    exam.status === "live"
      ? { label: "Writing now", value: inProgress.length, icon: "✍️" }
      : { label: "Avg score", value: avg, icon: "📊" },
  ];

  return (
    <>
      <Header name={admin.email} isAdmin />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-8">
        <div className="fade-up">
          <Link
            href="/admin"
            className="text-sm font-medium text-muted hover:text-ink transition-colors"
          >
            ← All exams
          </Link>
          <div className="flex items-start justify-between flex-wrap gap-4 mt-3">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                  {exam.title}
                </h1>
                <span className={`pill ${STATUS_PILL[exam.status]}`}>{exam.status}</span>
              </div>
            </div>
            <StatusControls
              examId={examId}
              status={exam.status as ExamStatus}
              questionCount={questionCount}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 fade-up">
          {stats.map((s) => (
            <div key={s.label} className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <span aria-hidden>{s.icon}</span> {s.label}
              </p>
              <p className="font-display text-2xl font-bold text-ink mt-1.5">{s.value}</p>
            </div>
          ))}
        </div>

        {exam.status === "draft" && (
          <div className="fade-up">
            <QuestionUpload examId={examId} existingCount={questionCount} />
          </div>
        )}

        <div className="fade-up">
          <QuestionEditor
            // Remounts with fresh rows whenever the question set changes (e.g. new upload).
            key={`${questionCount}-${questionDocs[0]?._id ?? "empty"}`}
            examId={examId}
            questions={editorRows}
            editable={exam.status === "draft"}
          />
        </div>

        <section className="card overflow-hidden fade-up">
          <div className="p-5 flex items-center justify-between flex-wrap gap-3 border-b border-line">
            <h2 className="font-display font-bold text-ink">
              Results
              {inProgress.length > 0 && (
                <span className="pill bg-emerald-50 text-emerald-700 ml-2.5">
                  {inProgress.length} writing now
                </span>
              )}
            </h2>
            <div className="flex gap-2">
              <Link href={`/leaderboard/${examId}`} className="btn btn-sm btn-outline">
                🏆 Leaderboard
              </Link>
              <DownloadCsvButton
                rows={csvRows}
                fileName={`${exam.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-results.csv`}
              />
            </div>
          </div>

          {attempts.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-xl bg-slate-50 border border-line flex items-center justify-center text-xl mb-3">
                👥
              </div>
              <p className="font-semibold text-ink text-sm">No attempts yet</p>
              <p className="text-sm text-muted mt-1">
                Students appear here the moment they start writing.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted bg-slate-50/80 text-xs uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Student</th>
                  <th className="px-5 py-3 text-right font-semibold">Score</th>
                  <th className="px-5 py-3 text-center hidden sm:table-cell font-semibold">
                    Violations
                  </th>
                  <th className="px-5 py-3 text-right hidden md:table-cell font-semibold">
                    Status
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((r) => {
                  const s = studentById.get(r.student_id.toString());
                  const initial = (s?.full_name ?? s?.email ?? "?").charAt(0).toUpperCase();
                  return (
                    <tr key={r._id.toString()} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <span className="h-8 w-8 shrink-0 rounded-full bg-slate-100 text-muted text-xs font-bold flex items-center justify-center">
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-ink block truncate">
                              {s?.full_name ?? "—"}
                            </span>
                            <span className="text-muted text-xs block truncate">{s?.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {r.status === "submitted" ? (
                          <>
                            <span className="font-display font-bold text-ink">{r.score}</span>
                            <span className="text-muted">/{r.total}</span>
                          </>
                        ) : (
                          <span className="pill bg-emerald-50 text-emerald-700">writing…</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-center hidden sm:table-cell">
                        {r.violations > 0 ? (
                          <span className="text-amber-600 font-semibold">⚠ {r.violations}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-xs text-muted hidden md:table-cell">
                        {r.status === "submitted"
                          ? r.auto_submitted
                            ? "Auto-submitted"
                            : "Submitted"
                          : "In progress"}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {r.status === "submitted" && (
                          <Link
                            href={`/results/${r._id.toString()}`}
                            className="text-xs font-semibold text-primary hover:text-primary-deep"
                          >
                            View answers →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </>
  );
}
