"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { OptionKey, StudentQuestion } from "@/lib/types";
import { MAX_VIOLATIONS } from "@/lib/types";

type Phase = "rules" | "loading" | "running" | "submitting" | "done";

interface StartPayload {
  attemptId: string;
  examTitle: string;
  deadline: string;
  serverNow: string;
  violations: number;
  savedAnswers: Record<string, OptionKey>;
  questions: StudentQuestion[];
}

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D"];

const RULES = [
  {
    icon: "🖥️",
    title: "Stay in fullscreen",
    text: "The exam runs in fullscreen. Leaving it counts as a violation.",
  },
  {
    icon: "🚫",
    title: "No tab switching",
    text: `Switching tabs or apps triggers a warning. After ${MAX_VIOLATIONS} warnings, your exam is submitted automatically.`,
  },
  {
    icon: "⏱️",
    title: "The clock never pauses",
    text: "The timer keeps running even if you close the page.",
  },
  {
    icon: "💾",
    title: "Everything auto-saves",
    text: "Answers save instantly. If the page reloads, you resume right where you left off.",
  },
];

export default function ExamPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("rules");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<StartPayload | null>(null);
  const [answers, setAnswers] = useState<Record<string, OptionKey>>({});
  const [current, setCurrent] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [violations, setViolations] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  // Refs so event handlers always see current values without re-binding.
  const phaseRef = useRef(phase);
  const dataRef = useRef(data);
  useEffect(() => {
    phaseRef.current = phase;
    dataRef.current = data;
  }, [phase, data]);
  const lastViolationAt = useRef(0);
  const clockOffset = useRef(0); // serverNow - clientNow, corrects a wrong device clock

  const submit = useCallback(
    async (auto: boolean) => {
      const d = dataRef.current;
      if (!d || phaseRef.current === "submitting" || phaseRef.current === "done") return;
      setPhase("submitting");
      try {
        const res = await fetch("/api/exam/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attemptId: d.attemptId }),
        });
        const body = await res.json();
        if (res.ok) {
          setResult({ score: body.score, total: body.total });
        }
      } catch {
        // even if the request fails, the server will close the attempt
        // when the teacher ends the exam
      }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      setPhase("done");
      if (auto) setWarning(null);
    },
    []
  );

  const reportViolation = useCallback(async () => {
    const d = dataRef.current;
    if (!d || phaseRef.current !== "running") return;
    // blur + visibilitychange + fullscreenchange can fire together for one action
    const now = Date.now();
    if (now - lastViolationAt.current < 2000) return;
    lastViolationAt.current = now;

    try {
      const res = await fetch("/api/exam/violation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: d.attemptId }),
      });
      const body = await res.json();
      setViolations(body.violations ?? 0);
      if (body.autoSubmitted) {
        await submit(true);
        return;
      }
      const left = MAX_VIOLATIONS - (body.violations ?? 0) + 1;
      setWarning(
        `You left the exam screen. This is warning ${body.violations} of ${MAX_VIOLATIONS}. ` +
          `${left <= 1 ? "One more violation and your exam will be submitted automatically." : ""}`
      );
    } catch {
      // network hiccup — don't punish the student for it
    }
  }, [submit]);

  async function start() {
    setPhase("loading");
    setError(null);
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // some browsers (e.g. iPhone Safari) don't allow fullscreen — continue anyway
    }
    const res = await fetch("/api/exam/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId }),
    });
    const body = await res.json();
    if (res.status === 409 && body.attemptId) {
      router.replace(`/results/${body.attemptId}`);
      return;
    }
    if (res.status === 428) {
      // No name on the profile yet — collect it, then come back.
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace("/setup");
      return;
    }
    if (!res.ok) {
      setError(body.error ?? "Could not start the exam");
      setPhase("rules");
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    const payload = body as StartPayload;
    clockOffset.current = new Date(payload.serverNow).getTime() - Date.now();
    setData(payload);
    setAnswers(payload.savedAnswers ?? {});
    setViolations(payload.violations ?? 0);
    setPhase("running");
  }

  // Countdown driven by the server deadline (device clock corrected).
  useEffect(() => {
    if (phase !== "running" || !data) return;
    const tick = () => {
      const now = Date.now() + clockOffset.current;
      const left = Math.max(0, Math.floor((new Date(data.deadline).getTime() - now) / 1000));
      setSecondsLeft(left);
      if (left <= 0) submit(true);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [phase, data, submit]);

  // Anti-cheat listeners.
  useEffect(() => {
    if (phase !== "running") return;

    const onVisibility = () => {
      if (document.hidden) reportViolation();
    };
    const onBlur = () => reportViolation();
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) reportViolation();
    };
    const block = (e: Event) => e.preventDefault();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);
    document.addEventListener("paste", block);
    window.addEventListener("beforeunload", onBeforeUnload);
    document.body.classList.add("exam-lockdown");

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.removeEventListener("paste", block);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.body.classList.remove("exam-lockdown");
    };
  }, [phase, reportViolation]);

  function selectAnswer(questionId: string, option: OptionKey) {
    if (!data) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
    // fire-and-forget save; answers are also graded from the last saved state
    fetch("/api/exam/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: data.attemptId, questionId, selected: option }),
    }).catch(() => {});
  }

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ---------- UI ----------

  if (phase === "rules" || phase === "loading") {
    return (
      <main className="aurora relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="dotgrid absolute inset-0" aria-hidden />
        <div className="relative w-full max-w-xl fade-up">
          <div className="card p-8">
            <p className="pill bg-indigo-50 text-primary mb-3">Exam rules</p>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-6">
              Before you start
            </h1>
            <ul className="space-y-4 mb-8">
              {RULES.map((rule) => (
                <li key={rule.title} className="flex gap-4">
                  <span className="h-10 w-10 shrink-0 rounded-xl bg-slate-50 border border-line flex items-center justify-center text-lg">
                    {rule.icon}
                  </span>
                  <div>
                    <p className="font-semibold text-ink text-sm">{rule.title}</p>
                    <p className="text-sm text-muted mt-0.5 leading-relaxed">{rule.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            {error && (
              <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5 mb-5">
                <span aria-hidden>⚠</span> {error}
              </p>
            )}
            <button
              onClick={start}
              disabled={phase === "loading"}
              className="btn btn-lg btn-primary w-full"
            >
              {phase === "loading" ? "Starting…" : "I understand — start the exam"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="aurora relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="dotgrid absolute inset-0" aria-hidden />
        <div className="relative card w-full max-w-md p-10 text-center fade-up">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-3xl mb-5">
            ✅
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink mb-1">
            Exam submitted
          </h1>
          {result ? (
            <p className="font-display text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-indigo-600 to-violet-600 my-5">
              {result.score}
              <span className="text-3xl text-slate-300">/{result.total}</span>
            </p>
          ) : (
            <p className="text-muted my-5">Your answers were recorded.</p>
          )}
          <p className="text-sm text-muted leading-relaxed mb-7">
            You can review each question with the correct answers once your teacher ends the
            exam.
          </p>
          <button onClick={() => router.push("/dashboard")} className="btn btn-lg btn-primary px-8">
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;
  const q = data.questions[current];
  const answeredCount = Object.keys(answers).length;
  const progress = Math.round((answeredCount / data.questions.length) * 100);

  // Group consecutive questions by section for the palette (empty section = "Questions").
  const paletteGroups: { section: string; items: { id: string; index: number }[] }[] = [];
  data.questions.forEach((question, index) => {
    const section = question.section ?? "";
    const last = paletteGroups[paletteGroups.length - 1];
    if (!last || last.section !== section) {
      paletteGroups.push({ section, items: [] });
    }
    paletteGroups[paletteGroups.length - 1].items.push({ id: question.id, index });
  });
  const hasSections = paletteGroups.some((g) => g.section !== "");

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-5">
      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card max-w-sm w-full p-7 text-center fade-up">
            <div className="mx-auto h-14 w-14 rounded-2xl bg-amber-50 flex items-center justify-center text-2xl mb-4">
              ⚠️
            </div>
            <p className="font-display font-bold text-ink mb-2">Hold on!</p>
            <p className="text-sm text-muted leading-relaxed mb-6">{warning}</p>
            <button
              onClick={() => {
                setWarning(null);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="btn btn-lg btn-primary w-full"
            >
              Return to exam
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="card px-5 py-4 mb-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-ink text-sm sm:text-base truncate">
              {data.examTitle}
            </h1>
            <p className="text-xs text-muted mt-0.5">
              {answeredCount} of {data.questions.length} answered
              {violations > 0 && (
                <span className="text-amber-600 font-medium ml-2">
                  ⚠ {violations} warning{violations > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
          <div
            className={`shrink-0 font-mono tabular-nums text-xl font-bold px-4 py-2 rounded-xl border ${
              secondsLeft <= 60
                ? "bg-red-50 text-danger border-red-100 animate-pulse"
                : "bg-slate-50 text-ink border-line"
            }`}
          >
            {fmt(secondsLeft)}
          </div>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 flex-1">
        {/* Question card */}
        <div className="flex-1 card p-6 sm:p-8 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <p className="pill bg-indigo-50 text-primary w-fit">
              Question {current + 1} / {data.questions.length}
            </p>
            {q.section && (
              <p className="pill bg-violet-50 text-violet-700 w-fit">{q.section}</p>
            )}
          </div>
          <p className="font-display text-lg sm:text-xl font-semibold text-ink leading-relaxed mb-7 whitespace-pre-wrap">
            {q.question}
          </p>
          <div className="space-y-3">
            {OPTION_KEYS.map((key) => {
              const text = q[`option_${key.toLowerCase()}` as keyof StudentQuestion] as string;
              const selected = answers[q.id] === key;
              return (
                <button
                  key={key}
                  onClick={() => selectAnswer(q.id, key)}
                  className={`group w-full text-left rounded-2xl border-2 px-4 py-3.5 flex items-center gap-3.5 transition-all ${
                    selected
                      ? "border-primary bg-indigo-50/70 shadow-[0_4px_16px_-6px_rgba(79,70,229,0.35)]"
                      : "border-line bg-surface hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-8 h-8 rounded-xl text-sm font-bold flex items-center justify-center transition-colors ${
                      selected
                        ? "bg-primary text-white"
                        : "bg-slate-100 text-muted group-hover:bg-slate-200"
                    }`}
                  >
                    {key}
                  </span>
                  <span className={`text-[15px] ${selected ? "font-medium text-ink" : "text-ink"}`}>
                    {text}
                  </span>
                  {selected && (
                    <span className="ml-auto text-primary" aria-hidden>
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-auto pt-8">
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="btn btn-outline"
            >
              ← Previous
            </button>
            {current < data.questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(data.questions.length - 1, c + 1))}
                className="btn bg-ink text-white hover:bg-slate-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Submit exam? You answered ${answeredCount} of ${data.questions.length} questions.`
                    )
                  ) {
                    submit(false);
                  }
                }}
                className="btn btn-success"
              >
                Submit exam ✓
              </button>
            )}
          </div>
        </div>

        {/* Question palette */}
        <div className="lg:w-60 card p-5 h-fit">
          {paletteGroups.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-4" : undefined}>
              <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2.5">
                {group.section || (hasSections ? "Other" : "Questions")}
              </p>
              <div className="grid grid-cols-8 lg:grid-cols-5 gap-2">
                {group.items.map(({ id, index }) => (
                  <button
                    key={id}
                    onClick={() => setCurrent(index)}
                    className={`h-9 rounded-lg text-xs font-bold transition-colors ${
                      index === current
                        ? "bg-ink text-white"
                        : answers[id]
                          ? "bg-indigo-100 text-primary-deep"
                          : "bg-slate-100 text-muted hover:bg-slate-200"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-indigo-100 border border-indigo-200" /> Answered
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-slate-100 border border-line" /> Pending
            </span>
          </div>
          <button
            onClick={() => {
              if (
                confirm(
                  `Submit exam? You answered ${answeredCount} of ${data.questions.length} questions.`
                )
              ) {
                submit(false);
              }
            }}
            className="btn btn-success w-full mt-5"
          >
            Submit exam
          </button>
        </div>
      </div>
    </main>
  );
}
