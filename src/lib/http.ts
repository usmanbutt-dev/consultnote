export type ApiErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "AUDIO_TOO_LARGE"
  | "UNSUPPORTED_AUDIO"
  | "NO_SPEECH"
  | "INVALID_AI_OUTPUT"
  | "AI_AUTH_FAILED"
  | "AI_UNAVAILABLE"
  | "AI_QUOTA_EXCEEDED"
  | "AI_TIMEOUT"
  | "STORAGE_FAILED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown): Response {
  const failure =
    error instanceof ApiError
      ? error
      : new ApiError(
          "INTERNAL_ERROR",
          "Something went wrong. Please try again.",
          500,
        );

  return Response.json(
    { error: { code: failure.code, message: failure.message } },
    { status: failure.status },
  );
}
