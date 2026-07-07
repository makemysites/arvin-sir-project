import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/adminGuard";
import { getDb } from "@/lib/db";
import Header from "@/components/Header";
import CreateExamForm from "@/components/admin/CreateExamForm";

export const dynamic = "force-dynamic";

const STATUS_PILL: Record<string, string> = {
  draft: "bg-slate-100 text-muted",
  live: "bg-emerald-50 text-emerald-700",
  ended: "bg-ink text-white",
};

export default async function AdminPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/");

  const db = await getDb();
  const exams = await db
    .collection("exams")
    .find({})
    .sort({ created_at: -1 })
    .toArray();

  return (
    <>
      <Header name={admin.email} isAdmin />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10 space-y-12">
        <section className="fade-up">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Exam console
          </h1>
          <p className="text-muted mt-1">
            Create an exam, upload questions, and go live when your class is ready.
          </p>
        </section>

        <section className="fade-up">
          <h2 className="font-display text-lg font-bold text-ink mb-4">Create a new exam</h2>
          <CreateExamForm />
        </section>

        <section className="fade-up">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-ink">Your exams</h2>
            {exams.length > 0 && <span className="text-sm text-muted">{exams.length} total</span>}
          </div>
          {exams.length === 0 ? (
            <div className="card p-10 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-2xl mb-4">
                📝
              </div>
              <p className="font-semibold text-ink">No exams yet</p>
              <p className="text-sm text-muted mt-1">Create your first exam above.</p>
            </div>
          ) : (
            <div className="card divide-y divide-line overflow-hidden">
              {exams.map((exam) => (
                <Link
                  key={exam._id.toString()}
                  href={`/admin/exam/${exam._id.toString()}`}
                  className="p-5 flex items-center justify-between gap-4 hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="h-11 w-11 shrink-0 rounded-xl bg-slate-50 border border-line flex items-center justify-center text-lg">
                      {exam.status === "live" ? "🟢" : exam.status === "ended" ? "🏁" : "📄"}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-ink truncate">{exam.title}</h3>
                      <p className="text-sm text-muted">
                        {exam.duration_minutes} min ·{" "}
                        {new Date(exam.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <span className={`pill shrink-0 ${STATUS_PILL[exam.status]}`}>
                    {exam.status}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
