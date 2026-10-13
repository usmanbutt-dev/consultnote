import { describe, expect, it } from "vitest";
import { ApiError, errorResponse } from "@/lib/http";

describe("public API errors", () => {
  it("returns the actionable status and public message for a known error", async () => {
    const response = errorResponse(
      new ApiError(
        "AI_QUOTA_EXCEEDED",
        "Your AI quota has been reached. Try again later.",
        429,
      ),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: {
        code: "AI_QUOTA_EXCEEDED",
        message: "Your AI quota has been reached. Try again later.",
      },
    });
  });

  it("hides credentials and internal details in unexpected failures", async () => {
    const response = errorResponse(
      new Error(
        "Provider failed with secret-key and private conversation text",
      ),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Something went wrong. Please try again.",
      },
    });
  });
});
