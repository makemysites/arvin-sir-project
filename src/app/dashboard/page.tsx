import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId, type WithId, type Document } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import { CATEGORY_PILL, EXAM_CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) redirect("/admin");

  const db = await getDb();
  const [profile, exams, attempts, materialFiles] = await Promise.all([
    db.collection("users").findOne({ _id: new ObjectId(user.id) }),
    db
      .collection("exams")
      .find({ status: { $in: ["live", "ended"] } })
      .sort({ created_at: -1 })
      .toArray(),
    db.collection("attempts").find({ student_id: new ObjectId(user.id) }).toArray(),
    db.collection("materials.files").find({}).sort({ uploadDate: -1 }).toArray(),
  ]);

  if (!profile?.full_name) redirect("/setup");

  const attemptByExam = new Map<string, WithId<Document>>(
    attempts.map((a) => [a.exam_id.toString(), a])
  );

  // Category tabs: /dashboard?category=Aptitude etc.
  const { category: rawCategory } = await searchParams;
  const activeCategory = EXAM_CATEGORIES.find((c) => c === rawCategory) ?? null;
  const visibleExams = activeCategory
    ? exams.filter((e) => e.category === activeCategory)
    : exams;

  const liveExams = visibleExams.filter((e) => e.status === "live");
  const pastExams = visibleExams.filter((e) => e.status === "ended");
  const firstName = String(profile.full_name).trim().split(/\s+/)[0];

  return (
    <>
      <Header name={profile.full_name} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-12">
        <section className="fade-up">
          <p className="text-sm font-medium text-muted">
            {new Date().toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink mt-1">
            Hey, {firstName} 👋
          </h1>
          <nav className="flex flex-wrap gap-2 mt-5" aria-label="Exam categories">
            <Link
              href="/dashboard"
              className={`btn btn-sm ${!activeCategory ? "bg-ink text-white" : "btn-outline"}`}
            >
              All exams
            </Link>
            {EXAM_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/dashboard?category=${c}`}
                className={`btn btn-sm ${activeCategory === c ? "bg-ink text-white" : "btn-outline"}`}
              >
                {c}
              </Link>
            ))}
          </nav>
        </section>

        <section className="fade-up">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-ink">Live exams</h2>
            {liveExams.length > 0 && (
              <span className="text-sm text-muted">{liveExams.length} running</span>
            )}
          </div>

          {liveExams.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">
                🕰️
              </div>
              <p className="font-semibold text-ink">
                No {activeCategory ? `${activeCategory} ` : ""}exam is running right now
              </p>
              <p className="text-sm text-muted mt-1">
                Your teacher will start one when it&apos;s time — keep this page handy.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {liveExams.map((exam) => {
                const examId = exam._id.toString();
                const attempt = attemptByExam.get(examId);
                return (
                  <div
                    key={examId}
                    className="relative card p-6 overflow-hidden"
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-500"
                      aria-hidden
                    />
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="pill bg-emerald-50 text-emerald-700">Live now</span>
                      {exam.category && (
                        <span className={`pill ${CATEGORY_PILL[exam.category] ?? "bg-slate-100 text-muted"}`}>
                          {exam.category}
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-bold text-lg text-ink leading-snug">
                      {exam.title}
                    </h3>
                    <p className="text-sm text-muted mt-1.5 flex items-center gap-1.5">
                      <span aria-hidden>⏱</span> {exam.duration_minutes} minutes
                    </p>
                    {attempt?.status === "submitted" ? (
                      <div className="mt-4 rounded-xl bg-slate-50 border border-line px-4 py-3 text-sm">
                        <span className="text-muted">Submitted — score </span>
                        <span className="font-bold text-ink">
                          {attempt.score}/{attempt.total}
                        </span>
                      </div>
                    ) : (
                      <Link href={`/exam/${examId}`} className="btn btn-primary w-full mt-5">
                        {attempt ? "Resume exam →" : "Start exam →"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {materialFiles.length > 0 && (
          <section className="fade-up">
            <h2 className="font-display text-lg font-bold text-ink mb-4">Study materials</h2>
            <div className="card divide-y divide-line overflow-hidden">
              {materialFiles.map((m) => {
                const size = Number(m.length ?? 0);
                const sizeLabel =
                  size < 1024 * 1024
                    ? `${Math.round(size / 1024)} KB`
                    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
                return (
                  <div
                    key={m._id.toString()}
                    className="p-4 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-10 w-10 shrink-0 rounded-xl bg-indigo-50 flex items-center justify-center text-lg">
                        📚
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-ink text-sm truncate">
                          {String(m.metadata?.title ?? m.filename)}
                        </p>
                        <p className="text-xs text-muted">
                          {sizeLabel} ·{" "}
                          {new Date(m.uploadDate).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/materials/${m._id.toString()}`}
                      className="btn btn-sm btn-outline shrink-0"
                    >
                      ⬇ Download
                    </a>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section className="fade-up">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Past exams</h2>
          {pastExams.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing here yet — your finished exams and scores will appear below.
            </p>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {pastExams.map((exam) => {
                const examId = exam._id.toString();
                const attempt = attemptByExam.get(examId);
                const pct =
                  attempt?.total ? Math.round((attempt.score / attempt.total) * 100) : null;
                return (
                  <div
                    key={examId}
                    className="p-5 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center font-display font-bold text-sm ${
                          pct === null
                            ? "bg-slate-100 text-slate-400"
                            : pct >= 60
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {pct === null ? "—" : `${pct}%`}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink truncate">
                          {exam.title}
                          {exam.category && (
                            <span
                              className={`pill ml-2 align-middle ${CATEGORY_PILL[exam.category] ?? "bg-slate-100 text-muted"}`}
                            >
                              {exam.category}
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-muted">
                          {attempt
                            ? `Your score: ${attempt.score}/${attempt.total}`
                            : "Not attempted"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {attempt && (
                        <Link href={`/results/${attempt._id.toString()}`} className="btn btn-sm btn-outline">
                          Review answers
                        </Link>
                      )}
                      <Link href={`/leaderboard/${examId}`} className="btn btn-sm btn-outline">
                        🏆 Leaderboard
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
