/* eslint-disable @next/next/no-html-link-for-pages -- Document navigation preserves draft protection during browser history traversal. */
"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { AudioLines, ArrowLeft } from "lucide-react";
import { doctorProfileSchema, type DoctorProfile } from "@/lib/account";
import { accountRequest } from "@/lib/account-client";
import { ProfileAvatar } from "./profile-avatar";
import { ProfileMenu } from "./profile-menu";
import { AccountDelete } from "./account-delete";

export function ProfileEditor({
  initialProfile,
}: {
  initialProfile: DoctorProfile;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [fields, setFields] = useState({
    fullName: initialProfile.fullName,
    specialty: initialProfile.specialty,
    clinic: initialProfile.clinic,
  });
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const leaving = useRef(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty =
    fields.fullName !== profile.fullName ||
    fields.specialty !== profile.specialty ||
    fields.clinic !== profile.clinic;
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (leaving.current) {
        leaving.current = false;
        return;
      }
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function allowLeave() {
    if (
      busy ||
      (dirty &&
        !window.confirm(
          "Leave your profile? Unsaved changes will be discarded.",
        ))
    )
      return false;
    leaving.current = true;
    return true;
  }
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    if (!allowLeave()) event.preventDefault();
  }
  async function changeProfile(
    kind: "profile" | "photo" | "removePhoto",
    file?: File,
  ) {
    if (active.current || busy || profile.deleting) return;
    if (
      file &&
      (file.size === 0 ||
        file.size > 2 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(file.type))
    ) {
      setError("Choose a JPG, PNG or WebP photo smaller than 2 MB.");
      return;
    }
    active.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = doctorProfileSchema.parse(
        await accountRequest(
          kind === "profile" ? "/api/account" : "/api/account/avatar",
          kind === "profile"
            ? {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(fields),
              }
            : kind === "photo"
              ? {
                  method: "POST",
                  headers: { "content-type": file!.type },
                  body: file,
                }
              : { method: "DELETE" },
        ),
      );
      setProfile(result);
      if (kind === "profile")
        setFields({
          fullName: result.fullName,
          specialty: result.specialty,
          clinic: result.clinic,
        });
      setMessage(
        kind === "profile"
          ? "Your profile is saved."
          : kind === "photo"
            ? "Your photo is updated."
            : "Your photo is removed.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Your changes could not be saved. Please retry.",
      );
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5 sm:px-8">
        <a
          href="/"
          onClick={navigate}
          className="flex items-center gap-2 font-semibold"
        >
          <AudioLines aria-hidden="true" size={23} className="text-teal-700" />
          ConsultNote
        </a>
        <ProfileMenu
          profile={profile}
          disabled={busy}
          onBeforeNavigate={allowLeave}
          onNavigationError={() => {
            leaving.current = false;
          }}
        />
      </header>
      <main className="mx-auto max-w-2xl px-5 py-8 sm:py-10">
        <a
          href="/"
          onClick={navigate}
          className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700"
        >
          <ArrowLeft aria-hidden="true" size={17} />
          Back to consultations
        </a>
        <h1 className="text-3xl font-semibold">My profile</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Your details and account settings.
        </p>
        {profile.deleting && (
          <p
            role="status"
            className="mt-5 rounded-lg bg-amber-50 p-4 text-sm leading-6 text-amber-900"
          >
            Account removal did not finish. Your workspace is paused. Retry
            Delete account below to finish cleanup.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-5 rounded-lg bg-red-50 p-4 text-sm leading-6 text-red-800"
          >
            {error}
          </p>
        )}
        {message && (
          <p
            role="status"
            className="mt-5 rounded-lg bg-teal-50 p-4 text-sm text-teal-900"
          >
            {message}
          </p>
        )}
        <section
          aria-label="Profile photo"
          className="soft-panel mt-6 flex flex-wrap items-center gap-5 p-6"
        >
          <ProfileAvatar profile={profile} size={72} />
          <div>
            <div className="flex flex-wrap gap-3">
              <button
                disabled={busy || profile.deleting}
                onClick={() => photoInput.current?.click()}
                className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-semibold disabled:opacity-50"
              >
                Change photo
              </button>
              {profile.avatarPath && (
                <button
                  disabled={busy || profile.deleting}
                  onClick={() => void changeProfile("removePhoto")}
                  className="min-h-11 px-2 text-sm font-medium text-slate-700 disabled:opacity-50"
                >
                  Remove photo
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              JPG, PNG or WebP · Up to 2 MB
            </p>
          </div>
          <input
            ref={photoInput}
            aria-label="Profile photo file"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            tabIndex={-1}
            disabled={busy || profile.deleting}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) void changeProfile("photo", file);
            }}
          />
        </section>
        <form
          aria-label="Edit profile"
          className="soft-panel mt-5 space-y-5 p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void changeProfile("profile");
          }}
        >
          {(
            [
              ["fullName", "Full name", 80, "name"],
              ["specialty", "Specialty (optional)", 80, "off"],
              ["clinic", "Clinic (optional)", 100, "organization"],
            ] as const
          ).map(([name, label, max, complete]) => (
            <label key={name} className="block text-sm font-medium">
              {label}
              <input
                name={name}
                autoComplete={complete}
                required={name === "fullName"}
                maxLength={max}
                value={fields[name]}
                disabled={busy || profile.deleting}
                onChange={(event) =>
                  setFields({ ...fields, [name]: event.currentTarget.value })
                }
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base disabled:opacity-60"
              />
            </label>
          ))}
          <div>
            <p className="text-sm font-medium">Account email</p>
            <p className="mt-2 break-words text-base text-slate-700">
              {profile.email}
            </p>
          </div>
          <button
            disabled={
              busy || profile.deleting || !dirty || !fields.fullName.trim()
            }
            className="min-h-11 rounded-lg bg-teal-700 px-5 text-sm font-semibold text-white hover:bg-teal-800 disabled:bg-slate-200 disabled:text-slate-500"
          >
            {busy ? "Please wait…" : "Save profile"}
          </button>
        </form>
        <section className="soft-panel mt-5 p-6">
          <h2 className="text-base font-semibold">Password</h2>
          <a
            href="/reset-password"
            onClick={navigate}
            className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-teal-700 underline underline-offset-4"
          >
            Change password
          </a>
        </section>
        <AccountDelete
          disabled={busy}
          onBusy={setBusy}
          onLeaving={() => {
            leaving.current = true;
          }}
          onFailure={async () => {
            try {
              setProfile(
                doctorProfileSchema.parse(await accountRequest("/api/account")),
              );
            } catch {
              /* Keep the loaded profile and allow retry. */
            }
          }}
        />
      </main>
    </div>
  );
}
