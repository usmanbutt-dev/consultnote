/* eslint-disable @next/next/no-html-link-for-pages -- Keep account transitions as document navigation to protect consultation drafts in browser history. */
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { ProfileEditor } from "@/components/profile-editor";
import { readDoctorProfile } from "@/lib/account-server";
import { requireSignedInUser } from "@/lib/supabase/server";
import { ApiError } from "@/lib/http";

export default async function AccountPage() {
  await connection();
  let profile;
  try {
    profile = await readDoctorProfile(await requireSignedInUser());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    return (
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-2xl font-semibold">Account setup is pending</h1>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          Doctor accounts become available after the Supabase account migration
          is installed.
        </p>
        <a
          href="/"
          className="mt-5 inline-flex min-h-11 items-center text-sm text-teal-700"
        >
          Back to consultations
        </a>
      </main>
    );
  }
  return <ProfileEditor initialProfile={profile} />;
}
