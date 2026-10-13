import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { processingConfiguration } from "@/lib/ai";
import { connection } from "next/server";
import { requireOwner } from "@/lib/supabase/server";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http";
import { readDoctorProfile } from "@/lib/account-server";
import type { DoctorProfile } from "@/lib/account";

export default async function HomePage() {
  await connection();
  let doctor: DoctorProfile | null = null;
  if (cloudMode()) {
    let owner;
    try {
      supabaseConfiguration();
      owner = await requireOwner();
    } catch (error) {
      if (error instanceof ApiError && error.code === "ACCOUNT_DELETING")
        redirect("/account");
      if (error instanceof ApiError && [401, 503].includes(error.status))
        redirect("/login");
      throw error;
    }
    if (owner) {
      try {
        doctor = await readDoctorProfile(owner);
      } catch {
        redirect("/account");
      }
      if (doctor.deleting) redirect("/account");
    }
  }
  return (
    <ConsultationWorkspace
      doctor={doctor}
      configuration={{ ...processingConfiguration(), cloud: cloudMode() }}
    />
  );
}
