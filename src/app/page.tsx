import { ConsultationWorkspace } from "@/components/consultation-workspace";
import { isGeminiConfigured } from "@/lib/gemini";
import { connection } from "next/server";

export default async function HomePage() {
  await connection();
  return <ConsultationWorkspace geminiConfigured={isGeminiConfigured()} />;
}
