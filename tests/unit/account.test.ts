import { expect, it } from "vitest";
import {
  profileInputSchema,
  deleteAccountSchema,
  avatarPath,
  doctorName,
} from "@/lib/account";

it("validates minor profile edits without accepting identity or privilege changes", () => {
  expect(
    profileInputSchema.parse({
      fullName: "  Ayesha Khan ",
      specialty: " Family medicine ",
      clinic: " Clinic A ",
    }),
  ).toEqual({
    fullName: "Ayesha Khan",
    specialty: "Family medicine",
    clinic: "Clinic A",
  });
  for (const extra of [
    { id: "someone-else" },
    { role: "admin" },
    { avatarPath: "other/photo.png" },
  ])
    expect(
      profileInputSchema.safeParse({
        fullName: "Doctor",
        specialty: "",
        clinic: "",
        ...extra,
      }).success,
    ).toBe(false);
  expect(
    profileInputSchema.safeParse({ fullName: " ", specialty: "", clinic: "" })
      .success,
  ).toBe(false);
});

it("requires password and explicit deletion confirmation", () => {
  expect(
    deleteAccountSchema.safeParse({
      password: "password123",
      confirmation: "DELETE",
    }).success,
  ).toBe(true);
  for (const input of [
    { password: "", confirmation: "DELETE" },
    { password: "password123", confirmation: "delete" },
    { password: "password123", confirmation: "DELETE", userId: "another" },
  ])
    expect(deleteAccountSchema.safeParse(input).success).toBe(false);
});

it("accepts only an owner's generated avatar path", () => {
  const owner = "9d617a5e-8818-4abb-a18a-04afbdce3757";
  const valid = `${owner}/339e2554-973d-45d8-bd31-5f26a725fff7.png`;
  expect(avatarPath(valid, owner)).toBe(valid);
  for (const path of [
    valid.replace(owner, "other"),
    `${owner}/../photo.png`,
    `https://example.com/${valid}`,
    `${owner}/avatar.svg`,
  ])
    expect(() => avatarPath(path, owner)).toThrow();
});

it("formats the account doctor's name without changing recorded identities", () => {
  expect(doctorName("Ayesha Khan")).toBe("Dr. Ayesha Khan");
  expect(doctorName("Dr. Ayesha Khan")).toBe("Dr. Ayesha Khan");
  expect(doctorName("")).toBe("Doctor");
});
