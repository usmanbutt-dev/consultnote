import "server-only";
import { ApiError } from "./http";

export function invalidProviderOutput(provider: string): ApiError {
  return new ApiError(
    "INVALID_AI_OUTPUT",
    `${provider} returned incomplete or invalid output. Retry, or use a shorter recording.`,
    502,
  );
}

export async function providerJson(
  provider: string,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<unknown> {
  let response: Response;
  try {
    signal.throwIfAborted();
    response = await fetch(url, { ...init, signal });
  } catch {
    if (signal.aborted)
      throw new ApiError(
        "AI_TIMEOUT",
        `${provider} took too long. Retry, or use a shorter recording.`,
        504,
      );
    throw new ApiError(
      "AI_UNAVAILABLE",
      `${provider} could not be reached. Check your connection, then retry.`,
      503,
    );
  }
  if (!response.ok) {
    if (response.status === 400) {
      const detail = await response.json().catch(() => null);
      if (detail?.error?.code === "json_validate_failed")
        throw invalidProviderOutput(provider);
      throw new ApiError(
        "AI_UNAVAILABLE",
        `${provider} rejected the processing request. Check the configured model before retrying.`,
        503,
      );
    }
    if ([401, 403].includes(response.status))
      throw new ApiError(
        "AI_AUTH_FAILED",
        `${provider} could not authenticate. Check its server-side API key.`,
        502,
      );
    if (response.status === 429)
      throw new ApiError(
        "AI_QUOTA_EXCEEDED",
        `${provider} quota reached. Wait a moment, then retry.`,
        429,
      );
    if ([408, 504].includes(response.status))
      throw new ApiError(
        "AI_TIMEOUT",
        `${provider} took too long. Retry, or use a shorter recording.`,
        504,
      );
    throw new ApiError(
      "AI_UNAVAILABLE",
      `${provider} is temporarily unavailable (${response.status}). Please retry later.`,
      503,
    );
  }
  try {
    return await response.json();
  } catch {
    throw invalidProviderOutput(provider);
  }
}

export async function withProviderDeadline<T>(
  provider: string,
  work: (signal: AbortSignal) => Promise<T>,
  deadlineMs = 120000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new ApiError(
          "AI_TIMEOUT",
          `${provider} took too long. Retry, or use a shorter recording.`,
          504,
        ),
      );
    }, deadlineMs);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    clearTimeout(timer!);
  }
}

export function waitForPoll(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => {
      clearTimeout(timer);
      reject(
        new ApiError(
          "AI_TIMEOUT",
          "Transcription took too long. Please retry.",
          504,
        ),
      );
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 1000);
    signal.addEventListener("abort", abort, { once: true });
  });
}
