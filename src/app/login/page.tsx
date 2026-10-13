import { AuthForm } from "@/components/auth-form";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { connection } from "next/server";

export default async function LoginPage() {
  await connection();
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
          <AuthForm />
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
