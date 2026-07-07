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
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <h1 className="text-xl font-bold text-slate-900 mb-3">Before you start</h1>
          <ul className="space-y-2 text-sm text-slate-700 list-disc pl-5 mb-5">
            <li>The exam runs in <strong>fullscreen</strong>. Do not exit it.</li>
            <li>
              <strong>Do not switch tabs or apps.</strong> After {MAX_VIOLATIONS} warnings your
              exam is submitted automatically.
            </li>
            <li>The timer keeps running even if you close the page — it cannot be paused.</li>
            <li>Answers are saved instantly as you select them.</li>
            <li>If your page reloads, just come back — you resume with your saved answers.</li>
          </ul>
          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
          <button
            onClick={start}
            disabled={phase === "loading"}
            className="w-full rounded-lg bg-indigo-600 text-white font-medium py-2.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            {phase === "loading" ? "Starting…" : "I understand — start the exam"}
          </button>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Exam submitted</h1>
          {result ? (
            <p className="text-4xl font-bold text-indigo-600 my-4">
              {result.score}<span className="text-slate-400 text-2xl">/{result.total}</span>
            </p>
          ) : (
            <p className="text-slate-500 my-4">Your answers were recorded.</p>
          )}
          <p className="text-sm text-slate-500 mb-6">
            You can review each question with the correct answers once your teacher ends the exam.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="rounded-lg bg-indigo-600 text-white font-medium py-2.5 px-6 hover:bg-indigo-700"
          >
            Back to dashboard
          </button>
        </div>
      </main>
    );
  }

  if (!data) return null;
  const q = data.questions[current];
  const answeredCount = Object.keys(answers).length;

  return (
    <main className="flex-1 flex flex-col max-w-5xl w-full mx-auto px-4 py-4">
      {/* Warning modal */}
      {warning && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center">
            <p className="text-3xl mb-2">⚠️</p>
            <p className="text-slate-800 font-medium mb-4">{warning}</p>
            <button
              onClick={() => {
                setWarning(null);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="rounded-lg bg-indigo-600 text-white font-medium py-2 px-6 hover:bg-indigo-700"
            >
              Return to exam
            </button>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4">
        <div>
          <h1 className="font-bold text-slate-900 text-sm sm:text-base">{data.examTitle}</h1>
          <p className="text-xs text-slate-500">
            {answeredCount}/{data.questions.length} answered
            {violations > 0 && (
              <span className="text-amber-600 ml-2">· {violations} warning{violations > 1 ? "s" : ""}</span>
            )}
          </p>
        </div>
        <div
          className={`font-mono text-xl font-bold px-3 py-1 rounded-lg ${
            secondsLeft <= 60 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-800"
          }`}
        >
          {fmt(secondsLeft)}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1">
        {/* Question card */}
        <div className="flex-1 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">
            Question {current + 1} of {data.questions.length}
          </p>
          <p className="text-slate-900 font-medium mb-5 whitespace-pre-wrap">{q.question}</p>
          <div className="space-y-2.5">
            {OPTION_KEYS.map((key) => {
              const text = q[`option_${key.toLowerCase()}` as keyof StudentQuestion] as string;
              const selected = answers[q.id] === key;
              return (
                <button
                  key={key}
                  onClick={() => selectAnswer(q.id, key)}
                  className={`w-full text-left rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors ${
                    selected
                      ? "border-indigo-600 bg-indigo-50"
                      : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-6 h-6 rounded-full text-sm font-semibold flex items-center justify-center ${
                      selected ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {key}
                  </span>
                  <span className="text-slate-800">{text}</span>
                </button>
              );
            })}
          </div>
          <div className="flex justify-between mt-auto pt-6">
            <button
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              disabled={current === 0}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            {current < data.questions.length - 1 ? (
              <button
                onClick={() => setCurrent((c) => Math.min(data.questions.length - 1, c + 1))}
                className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-700"
              >
                Next →
              </button>
            ) : (
              <button
                onClick={() => {
                  if (confirm(`Submit exam? You answered ${answeredCount} of ${data.questions.length} questions.`)) {
                    submit(false);
                  }
                }}
                className="rounded-lg bg-emerald-600 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-700"
              >
                Submit exam
              </button>
            )}
          </div>
        </div>

        {/* Question palette */}
        <div className="lg:w-56 bg-white border border-slate-200 rounded-xl p-4 h-fit">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">Questions</p>
          <div className="grid grid-cols-8 lg:grid-cols-5 gap-1.5">
            {data.questions.map((question, i) => (
              <button
                key={question.id}
                onClick={() => setCurrent(i)}
                className={`h-8 rounded-md text-xs font-semibold ${
                  i === current
                    ? "bg-slate-900 text-white"
                    : answers[question.id]
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-100 text-slate-500"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (confirm(`Submit exam? You answered ${answeredCount} of ${data.questions.length} questions.`)) {
                submit(false);
              }
            }}
            className="w-full mt-4 rounded-lg bg-emerald-600 text-white py-2 text-sm font-medium hover:bg-emerald-700"
          >
            Submit exam
          </button>
        </div>
      </div>
    </main>
  );
}
