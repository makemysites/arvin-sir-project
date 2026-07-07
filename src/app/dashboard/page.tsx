import Link from "next/link";
import { redirect } from "next/navigation";
import { ObjectId, type WithId, type Document } from "mongodb";
import { getUser, isAdminEmail } from "@/lib/auth";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (isAdminEmail(user.email)) redirect("/admin");

  const db = await getDb();
  const [profile, exams, attempts] = await Promise.all([
    db.collection("users").findOne({ _id: new ObjectId(user.id) }),
    db
      .collection("exams")
      .find({ status: { $in: ["live", "ended"] } })
      .sort({ created_at: -1 })
      .toArray(),
    db.collection("attempts").find({ student_id: new ObjectId(user.id) }).toArray(),
  ]);

  if (!profile?.full_name) redirect("/setup");

  const attemptByExam = new Map<string, WithId<Document>>(
    attempts.map((a) => [a.exam_id.toString(), a])
  );
  const liveExams = exams.filter((e) => e.status === "live");
  const pastExams = exams.filter((e) => e.status === "ended");

  return (
    <>
      <Header name={profile.full_name} />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-8 space-y-10">
        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Live exams</h2>
          {liveExams.length === 0 ? (
            <p className="text-slate-500 text-sm bg-white border border-slate-200 rounded-xl p-6 text-center">
              No exam is running right now. Your teacher will start one when it&apos;s time.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {liveExams.map((exam) => {
                const examId = exam._id.toString();
                const attempt = attemptByExam.get(examId);
                return (
                  <div
                    key={examId}
                    className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 uppercase">Live</span>
                    </div>
                    <h3 className="font-semibold text-slate-900">{exam.title}</h3>
                    <p className="text-sm text-slate-500">{exam.duration_minutes} minutes</p>
                    {attempt?.status === "submitted" ? (
                      <p className="text-sm font-medium text-slate-700 mt-1">
                        Submitted — score: {attempt.score}/{attempt.total}
                      </p>
                    ) : (
                      <Link
                        href={`/exam/${examId}`}
                        className="mt-2 inline-block text-center rounded-lg bg-indigo-600 text-white font-medium py-2 px-4 hover:bg-indigo-700"
                      >
                        {attempt ? "Resume exam" : "Start exam"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900 mb-3">Past exams</h2>
          {pastExams.length === 0 ? (
            <p className="text-slate-500 text-sm">No past exams yet.</p>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {pastExams.map((exam) => {
                const examId = exam._id.toString();
                const attempt = attemptByExam.get(examId);
                return (
                  <div
                    key={examId}
                    className="p-4 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900">{exam.title}</h3>
                      <p className="text-sm text-slate-500">
                        {attempt
                          ? `Your score: ${attempt.score}/${attempt.total}`
                          : "Not attempted"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {attempt && (
                        <Link
                          href={`/results/${attempt._id.toString()}`}
                          className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                        >
                          Review answers
                        </Link>
                      )}
                      <Link
                        href={`/leaderboard/${examId}`}
                        className="text-sm rounded-lg border border-slate-300 px-3 py-1.5 hover:bg-slate-50"
                      >
                        Leaderboard
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
