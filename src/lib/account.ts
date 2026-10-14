import { z } from "zod";
import { ApiError } from "./http";

z.config({ jitless: true });

export const profileInputSchema = z.strictObject({
  fullName: z.string().trim().min(1).max(80),
  specialty: z.string().trim().max(80),
  clinic: z.string().trim().max(100),
});
export const doctorProfileSchema = profileInputSchema.safeExtend({
  id: z.uuid(),
  email: z.email(),
  avatarPath: z.string().nullable(),
  deleting: z.boolean(),
});
export type DoctorProfile = z.infer<typeof doctorProfileSchema>;
export const deleteAccountSchema = z.strictObject({
  password: z.string().min(1).max(128),
  confirmation: z.literal("DELETE"),
});
export function doctorName(name: string): string {
  const trimmed = name.trim();
  return !trimmed || trimmed === "Doctor"
    ? "Doctor"
    : /^dr\.?\s/i.test(trimmed)
      ? trimmed
      : `Dr. ${trimmed}`;
}
export function avatarPath(path: string, userId: string): string {
  const parts = path.split("/");
  const match = parts[1]?.match(/^([0-9a-f-]{36})\.(png|jpg|webp)$/i);
  if (
    parts.length !== 2 ||
    parts[0] !== userId ||
    !match ||
    !z.uuid().safeParse(match[1]).success
  )
    throw new ApiError(
      "NOT_FOUND",
      "Your profile photo could not be found.",
      404,
    );
  return path;
}
