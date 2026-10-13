// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AuthForm } from "@/components/auth-form";
import { ProfileEditor } from "@/components/profile-editor";
import { PasswordForm } from "@/components/password-form";

const auth = vi.hoisted(() => ({
  signUp: vi.fn(),
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
}));
vi.mock("@/lib/supabase/browser", () => ({
  browserSupabase: () => ({ auth }),
}));
const profile = {
  id: "9d617a5e-8818-4abb-a18a-04afbdce3757",
  email: "doctor@example.test",
  fullName: "Ayesha Khan",
  specialty: "",
  clinic: "",
  avatarPath: null,
  deleting: false,
};
let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function button(text: string) {
  const result = [...host.querySelectorAll("button")].find(
    (x) => x.textContent?.trim() === text,
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
async function fill(name: string, value: string) {
  const input = host.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  if (!input) throw new Error(`Missing field: ${name}`);
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
async function submit(label?: string) {
  const form = host.querySelector<HTMLFormElement>(
    label ? `form[aria-label="${label}"]` : "form",
  )!;
  await act(() =>
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    ),
  );
}

it("signs up with a doctor name and shows confirmation without assuming a session", async () => {
  auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  await act(() => root.render(createElement(AuthForm)));
  await act(() => button("Create an account").click());
  await fill("fullName", "Ayesha Khan");
  await fill("email", "doctor@example.test");
  await fill("password", "password123");
  await submit();
  expect(auth.signUp).toHaveBeenCalledWith(
    expect.objectContaining({
      email: "doctor@example.test",
      options: expect.objectContaining({ data: { full_name: "Ayesha Khan" } }),
    }),
  );
  expect(host.textContent).toContain("Check your email");
});

it("provides a recovery flow without revealing whether an email has an account", async () => {
  auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  await act(() => root.render(createElement(AuthForm)));
  await act(() => button("Forgot password?").click());
  await fill("email", "doctor@example.test");
  await submit();
  expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
    "doctor@example.test",
    expect.objectContaining({
      redirectTo: expect.stringContaining(
        "/auth/callback?next=/reset-password",
      ),
    }),
  );
  expect(host.textContent).toContain("If an account exists");
});

it("updates only minor profile fields and retains inputs after a failed save", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      Response.json(
        { error: { message: "Please retry saving." } },
        { status: 503 },
      ),
    );
  vi.stubGlobal("fetch", fetch);
  await act(() =>
    root.render(createElement(ProfileEditor, { initialProfile: profile })),
  );
  await fill("fullName", "Ayesha Malik");
  await submit("Edit profile");
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe("/api/account");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({
    fullName: "Ayesha Malik",
    specialty: "",
    clinic: "",
  });
  expect(
    host.querySelector<HTMLInputElement>('input[name="fullName"]')!.value,
  ).toBe("Ayesha Malik");
  expect(host.textContent).toContain("Please retry saving.");
});

it("requires matching passwords and clears the form only after a successful update", async () => {
  auth.updateUser.mockResolvedValue({ error: null });
  await act(() => root.render(createElement(PasswordForm)));
  await fill("password", "new-password123");
  await fill("confirmPassword", "different-password");
  await submit();
  expect(auth.updateUser).not.toHaveBeenCalled();
  expect(host.textContent).toContain("same password");
  await fill("confirmPassword", "new-password123");
  await submit();
  expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password123" });
  expect(host.textContent).toContain("Your password is changed");
  expect(
    host.querySelector<HTMLInputElement>('input[name="password"]')!.value,
  ).toBe("");
});

it("requires typed confirmation for deletion and keeps the profile after rejection", async () => {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
    init?.method === "DELETE"
      ? Response.json(
          { error: { message: "The current password is incorrect." } },
          { status: 401 },
        )
      : Response.json(profile),
  );
  vi.stubGlobal("fetch", fetch);
  await act(() =>
    root.render(createElement(ProfileEditor, { initialProfile: profile })),
  );
  expect(button("Delete my account permanently").disabled).toBe(true);
  await fill("currentPassword", "wrong-password");
  await fill("deleteConfirmation", "delete");
  expect(button("Delete my account permanently").disabled).toBe(true);
  await fill("deleteConfirmation", "DELETE");
  expect(button("Delete my account permanently").disabled).toBe(false);
  await submit("Delete account");
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    password: "wrong-password",
    confirmation: "DELETE",
  });
  expect(host.textContent).toContain("The current password is incorrect");
  expect(
    host.querySelector<HTMLInputElement>('input[name="fullName"]')!.value,
  ).toBe("Ayesha Khan");
  expect(
    host.querySelector<HTMLInputElement>('input[name="currentPassword"]')!
      .value,
  ).toBe("");
});
