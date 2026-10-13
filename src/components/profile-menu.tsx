"use client";
import { useId, useState, type MouseEvent } from "react";
import { LogOut, UserRound } from "lucide-react";
import { doctorName, type DoctorProfile } from "@/lib/account";
import { accountRequest } from "@/lib/account-client";
import { ProfileAvatar } from "./profile-avatar";

export function ProfileMenu({
  profile,
  disabled = false,
  onBeforeNavigate,
  onNavigationError,
}: {
  profile: DoctorProfile | null;
  disabled?: boolean;
  onBeforeNavigate?: (action: "navigate" | "signout") => boolean;
  onNavigationError?: () => void;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (disabled || busy) {
      event.preventDefault();
      return;
    }
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    if (onBeforeNavigate?.("navigate") === false) event.preventDefault();
  }
  return (
    <div>
      <button
        aria-label="Account menu"
        popoverTarget={id}
        disabled={disabled || busy}
        className="flex size-11 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-700 disabled:opacity-50"
      >
        <ProfileAvatar profile={profile} />
      </button>
      <div
        id={id}
        popover="auto"
        aria-label="Your account"
        className="fixed inset-auto top-20 right-5 z-30 m-0 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl"
      >
        {profile ? (
          <>
            <div className="border-b border-slate-100 px-3 py-3">
              <p className="font-semibold text-slate-900">
                {doctorName(profile.fullName)}
              </p>
              <p className="mt-1 break-words text-slate-600">{profile.email}</p>
            </div>
            <a
              href="/account"
              onClick={navigate}
              className="mt-2 flex min-h-11 items-center gap-3 rounded-lg px-3 font-medium hover:bg-slate-50"
            >
              <UserRound aria-hidden="true" size={18} />
              My profile
            </a>
            <button
              disabled={disabled || busy}
              onClick={async () => {
                if (busy || onBeforeNavigate?.("signout") === false) return;
                setBusy(true);
                setError("");
                try {
                  await accountRequest("/api/auth/signout", { method: "POST" });
                  window.location.assign("/login");
                } catch (failure) {
                  onNavigationError?.();
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "Sign-out failed. Please retry.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
              className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              <LogOut aria-hidden="true" size={18} />
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </>
        ) : (
          <>
            <p className="px-3 py-2 font-semibold">Your account</p>
            <a
              href="/login"
              onClick={navigate}
              className="block rounded-lg px-3 py-3 font-medium text-teal-700 hover:bg-teal-50"
            >
              Sign in
            </a>
          </>
        )}
        {error && (
          <p role="alert" className="px-3 py-2 text-red-800">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
