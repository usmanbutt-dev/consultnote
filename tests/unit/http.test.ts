import { describe, expect, it } from "vitest";
import {
  ApiError,
  errorResponse,
  readBoundedBody,
  readJsonRequest,
} from "@/lib/http";

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

describe("bounded request bodies", () => {
  it("reads a body exactly at the limit without trusting Content-Length", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "0" },
      body: "1234",
    });
    expect(await readBoundedBody(request, 4)).toEqual(
      new TextEncoder().encode("1234"),
    );
  });

  it("cancels a chunked oversized upload even when Content-Length lies", async () => {
    let canceled = false;
    const body = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(6 * 1024 * 1024));
      },
      cancel() {
        canceled = true;
      },
    });
    const request = new Request("http://localhost", {
      method: "POST",
      headers: { "content-length": "1" },
      body,
      duplex: "half",
    } as RequestInit);
    await expect(
      readBoundedBody(request, 11 * 1024 * 1024),
    ).rejects.toMatchObject({ code: "AUDIO_TOO_LARGE", status: 413 });
    expect(canceled).toBe(true);
  });

  it("parses a valid JSON body", async () => {
    expect(
      await readJsonRequest(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: '{"title":"Visit"}',
        }),
      ),
    ).toEqual({ title: "Visit" });
  });

  it("rejects malformed, missing, or wrongly typed JSON", async () => {
    for (const [type, body] of [
      ["application/json", "{"],
      ["application/json", ""],
      ["text/plain", "{}"],
    ]) {
      await expect(
        readJsonRequest(
          new Request("http://localhost", {
            method: "POST",
            headers: { "content-type": type },
            body,
          }),
        ),
      ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 400 });
    }
  });

  it("bounds JSON bodies to 1 MiB", async () => {
    await expect(
      readJsonRequest(
        new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: " ".repeat(1024 * 1024 + 1),
        }),
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT", status: 413 });
  });
});
