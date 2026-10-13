import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { processingConfiguration } from "@/lib/ai";
import { connection } from "next/server";
import { requireOwner } from "@/lib/supabase/server";
import { cloudMode, supabaseConfiguration } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import { ApiError } from "@/lib/http";

export default async function HomePage() {
  await connection();
  if (cloudMode()) {
    try {
      supabaseConfiguration();
      await requireOwner();
    } catch (error) {
      if (error instanceof ApiError && [401, 503].includes(error.status))
        redirect("/login");
      throw error;
    }
  }
  return (
    <ConsultationWorkspace
      configuration={{ ...processingConfiguration(), cloud: cloudMode() }}
    />
  );
}
