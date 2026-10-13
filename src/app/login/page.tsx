import { AuthForm } from "@/components/auth-form";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { connection } from "next/server";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; recovery?: string }>;
}) {
  await connection();
  const params = await searchParams;
  let configured = false;
  try {
    configured = cloudMode() && Boolean(supabaseConfiguration());
  } catch {
    /* Setup is pending. */
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <div className="soft-panel w-full p-8">
        {configured ? (
          <>
            {params.deleted === "1" && (
              <p
                role="status"
                className="mb-5 rounded-lg bg-teal-50 p-3 text-sm text-teal-900"
              >
                Your account has been deleted.
              </p>
            )}
            {params.recovery === "expired" && (
              <p
                role="status"
                className="mb-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"
              >
                This link has expired or could not be verified. Sign in or
                request a new password reset link.
              </p>
            )}
            <AuthForm />
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Cloud setup is pending</h1>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Configure Supabase using the project’s deployment guide to enable
              accounts and cloud storage.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
