/* eslint-disable @next/next/no-html-link-for-pages -- Keep account transitions as document navigation to protect consultation drafts in browser history. */
"use client";
import { useRef, useState } from "react";
import { browserSupabase } from "@/lib/supabase/browser";

export function PasswordForm() {
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (active.current) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        const password = String(data.get("password") ?? "");
        if (
          password.length < 8 ||
          password.length > 128 ||
          password !== data.get("confirmPassword")
        ) {
          setError(
            "Use at least 8 characters and enter the same password in both fields.",
          );
          return;
        }
        active.current = true;
        setBusy(true);
        setError("");
        setSaved(false);
        try {
          const result = await browserSupabase().auth.updateUser({ password });
          if (result.error) {
            setError(
              "The password could not be changed. Request a new reset link if this one expired.",
            );
            return;
          }
          form.reset();
          setSaved(true);
        } catch {
          setError("Could not connect. Please retry.");
        } finally {
          active.current = false;
          setBusy(false);
        }
      }}
    >
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Set a new password
        </h1>
        <p className="mt-1.5 text-sm leading-5 text-slate-600">
          Choose a password with at least 8 characters.
        </p>
      </div>
      {[
        ["password", "New password"],
        ["confirmPassword", "Confirm new password"],
      ].map(([name, label]) => (
        <label key={name} className="block text-sm font-medium">
          {label}
          <input
            name={name}
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            disabled={busy}
            className="auth-input mt-1.5 min-h-11 w-full rounded-lg border border-slate-300 bg-slate-50/60 px-3 text-base text-slate-900"
          />
        </label>
      ))}
      {error && (
        <p role="alert" className="text-sm leading-6 text-red-800">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm leading-6 text-teal-800">
          Your password is changed.
        </p>
      )}
      <button
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save password"}
      </button>
      <a
        href="/"
        className="flex min-h-11 items-center justify-center text-sm font-medium text-teal-700"
      >
        Back to consultations
      </a>
    </form>
  );
}
