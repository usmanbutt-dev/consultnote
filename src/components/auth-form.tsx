"use client";
import { useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

export function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <form
      className="space-y-5"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        const form = new FormData(event.currentTarget);
        try {
          const client = browserSupabase();
          const credentials = {
            email: String(form.get("email")),
            password: String(form.get("password")),
          };
          const result = signup
            ? await client.auth.signUp({
                ...credentials,
                options: {
                  emailRedirectTo: `${window.location.origin}/auth/callback`,
                },
              })
            : await client.auth.signInWithPassword(credentials);
          if (result.error) {
            setMessage(
              signup
                ? "Account creation failed. Check your details or try again later."
                : "Sign-in failed. Check your email and password.",
            );
            return;
          }
          if (result.data.session) window.location.assign("/");
          else
            setMessage(
              "Check your email to confirm your account, then sign in.",
            );
        } catch {
          setMessage("Could not connect. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <h1 className="text-2xl font-semibold">
        {signup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="text-sm text-slate-500">
        Your consultations, in your workspace.
      </p>
      <label className="block text-sm">
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"
        />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          minLength={8}
          autoComplete={signup ? "new-password" : "current-password"}
          required
          disabled={busy}
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3"
        />
      </label>
      {message && (
        <p role="status" className="text-sm leading-6 text-slate-600">
          {message}
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-teal-700 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setSignup(!signup);
          setMessage("");
        }}
        className="min-h-11 w-full text-sm text-teal-700"
      >
        {signup ? "Already have an account? Sign in" : "Create an account"}
      </button>
    </form>
  );
}
