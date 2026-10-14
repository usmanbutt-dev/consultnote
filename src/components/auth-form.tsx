"use client";
import { useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

export function AuthForm() {
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function changeMode(next: typeof mode) {
    setMode(next);
    setMessage("");
    setError("");
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (active.current) return;
        active.current = true;
        setBusy(true);
        setMessage("");
        setError("");
        const fields = new FormData(event.currentTarget);
        const email = String(fields.get("email") ?? "").trim();
        try {
          const client = browserSupabase();
          if (mode === "recover") {
            const result = await client.auth.resetPasswordForEmail(email, {
              redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
            });
            if (result.error)
              setError(
                "The reset request could not be sent. Please retry shortly.",
              );
            else
              setMessage(
                "If an account exists for this email, you will receive a password reset link.",
              );
            return;
          }
          const credentials = {
            email,
            password: String(fields.get("password") ?? ""),
          };
          const fullName = String(fields.get("fullName") ?? "").trim();
          if (mode === "signup" && (!fullName || fullName.length > 80)) {
            setError("Enter your full name, up to 80 characters.");
            return;
          }
          const result =
            mode === "signup"
              ? await client.auth.signUp({
                  ...credentials,
                  options: {
                    data: { full_name: fullName },
                    emailRedirectTo: `${window.location.origin}/auth/callback`,
                  },
                })
              : await client.auth.signInWithPassword(credentials);
          if (result.error) {
            setError(
              mode === "signup"
                ? "Account creation failed. Check your details or try again later."
                : "Sign-in failed. Check your email and password, and confirm your email if needed.",
            );
            return;
          }
          if (result.data.session) window.location.assign("/");
          else
            setMessage(
              "Check your email to confirm your account, then sign in.",
            );
        } catch {
          setError("Could not connect. Please try again.");
        } finally {
          active.current = false;
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {mode === "signup"
            ? "Create your doctor account"
            : mode === "recover"
              ? "Reset your password"
              : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          {mode === "recover"
            ? "Enter your email to request a reset link."
            : "Your consultations, in your private workspace."}
        </p>
      </div>
      {mode === "signup" && (
        <label className="block text-sm font-medium">
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            maxLength={80}
            disabled={busy}
            className="auth-input mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-base text-slate-900"
          />
        </label>
      )}
      <label className="block text-sm font-medium">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          className="auth-input mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-base text-slate-900"
        />
      </label>
      {mode !== "recover" && (
        <label className="block text-sm font-medium">
          Password
          <input
            name="password"
            type="password"
            minLength={mode === "signup" ? 8 : 1}
            maxLength={128}
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            required
            disabled={busy}
            className="auth-input mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-base text-slate-900"
          />
          {mode === "signup" && (
            <span className="mt-1.5 block font-normal text-slate-600">
              At least 8 characters.
            </span>
          )}
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900"
        >
          {message}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
      >
        {busy
          ? "Please wait…"
          : mode === "signup"
            ? "Create account"
            : mode === "recover"
              ? "Send reset link"
              : "Sign in"}
      </button>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2">
        {mode === "login" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => changeMode("recover")}
            className="min-h-11 text-sm font-medium text-teal-700 hover:text-teal-900"
          >
            Forgot password?
          </button>
        )}
        <button
          type="button"
          disabled={busy}
          onClick={() => changeMode(mode === "login" ? "signup" : "login")}
          className={
            "min-h-11 text-sm font-medium text-teal-700 hover:text-teal-900 " +
            (mode === "login" ? "" : "w-full")
          }
        >
          {mode === "login" ? "Create an account" : "Back to sign in"}
        </button>
      </div>
    </form>
  );
}
