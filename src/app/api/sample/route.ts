import { sampleConsultation } from "@/lib/sample";
export const runtime = "nodejs";
export function GET(): Response {
  return Response.json(sampleConsultation());
}
