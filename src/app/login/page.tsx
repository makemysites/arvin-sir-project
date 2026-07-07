"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not send the code");
        return;
      }
      setInfo("Code sent! It can take a minute to arrive — check spam too.");
      setStep("otp");
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: otp.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Invalid or expired code. Please try again.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="aurora relative flex-1 flex items-center justify-center p-4 overflow-hidden">
      <div className="dotgrid absolute inset-0" aria-hidden />

      <div className="relative w-full max-w-md fade-up">
        <div className="flex flex-col items-center text-center mb-8">
          <Logo className="h-14 w-14 mb-4" />
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">
            Aptitude<span className="text-primary">·</span>Portal
          </h1>
          <p className="text-muted mt-2 text-[15px]">
            {step === "email"
              ? "Sign in with your email to continue"
              : "One more step — enter your code"}
          </p>
        </div>

        <div className="card p-7">
          {step === "email" ? (
            <form onSubmit={sendOtp} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-ink mb-1.5">
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="field"
                />
              </div>
              <button type="submit" disabled={loading} className="btn btn-lg btn-primary w-full">
                {loading ? "Sending code…" : "Send login code"}
              </button>
              <p className="text-xs text-muted text-center leading-relaxed">
                No password needed — we&apos;ll email you a 6-digit code.
                <br />
                New here? Your account is created automatically.
              </p>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-5">
              {info && (
                <div className="flex items-start gap-2.5 text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-xl p-3.5">
                  <span aria-hidden>✉️</span>
                  <span>{info}</span>
                </div>
              )}
              <div>
                <label htmlFor="otp" className="block text-sm font-semibold text-ink mb-1.5">
                  Code sent to <span className="text-primary">{email}</span>
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••••"
                  className="field field-otp"
                />
              </div>
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="btn btn-lg btn-primary w-full"
              >
                {loading ? "Verifying…" : "Verify & sign in"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setInfo(null);
                  setError(null);
                }}
                className="w-full text-sm font-medium text-muted hover:text-ink transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          )}
          {error && (
            <p className="flex items-start gap-2 text-sm text-danger bg-red-50 border border-red-100 rounded-xl p-3.5 mt-5">
              <span aria-hidden>⚠</span> {error}
            </p>
          )}
        </div>

        <p className="text-center text-xs text-muted mt-6">
          Secure email verification · No passwords stored
        </p>
      </div>
    </main>
  );
}
