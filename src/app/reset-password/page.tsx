import { connection } from "next/server";
import { redirect } from "next/navigation";
import { requireSignedInUser } from "@/lib/supabase/server";
import { PasswordForm } from "@/components/password-form";

export default async function ResetPasswordPage() {
  await connection();
  try {
    await requireSignedInUser();
  } catch {
    redirect("/login?recovery=expired");
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm items-center px-5 py-8">
      <div className="soft-panel w-full p-6">
        <PasswordForm />
      </div>
    </main>
  );
}
