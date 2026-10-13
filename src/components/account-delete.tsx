"use client";
import { useRef, useState } from "react";
import { accountRequest } from "@/lib/account-client";

export function AccountDelete({
  disabled,
  onBusy,
  onLeaving,
  onFailure,
}: {
  disabled: boolean;
  onBusy: (busy: boolean) => void;
  onLeaving: () => void;
  onFailure: () => Promise<void>;
}) {
  const active = useRef(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  return (
    <details className="mt-7 rounded-xl border border-red-200 bg-white p-6">
      <summary className="cursor-pointer text-base font-semibold text-red-800">
        Delete account
      </summary>
      <p className="mt-4 text-sm leading-6 text-slate-700">
        This permanently removes your account, profile, consultations, uploaded
        photos and recordings stored by ConsultNote. It cannot be undone.
      </p>
      <form
        aria-label="Delete account"
        className="mt-5 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (
            disabled ||
            active.current ||
            confirmation !== "DELETE" ||
            !password
          )
            return;
          active.current = true;
          onBusy(true);
          setError("");
          try {
            await accountRequest("/api/account", {
              method: "DELETE",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password, confirmation }),
            });
            onLeaving();
            window.location.assign("/login?deleted=1");
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Account removal did not finish. Please retry.",
            );
            await onFailure();
          } finally {
            setPassword("");
            active.current = false;
            onBusy(false);
          }
        }}
      >
        <label className="block text-sm font-medium">
          Current password
          <input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            value={password}
            disabled={disabled}
            onChange={(event) => setPassword(event.currentTarget.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          Type DELETE to confirm
          <input
            name="deleteConfirmation"
            autoComplete="off"
            required
            value={confirmation}
            disabled={disabled}
            onChange={(event) => setConfirmation(event.currentTarget.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm leading-6 text-red-800">
            {error}
          </p>
        )}
        <button
          disabled={disabled || !password || confirmation !== "DELETE"}
          className="min-h-11 rounded-lg bg-red-700 px-5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-500"
        >
          {disabled ? "Please wait…" : "Delete my account permanently"}
        </button>
      </form>
    </details>
  );
}
