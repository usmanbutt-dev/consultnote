import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { processingConfiguration } from "@/lib/ai";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  return <ConsultationWorkspace configuration={processingConfiguration()} />;
}
