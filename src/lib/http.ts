export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "CONFIGURATION_REQUIRED"
  | "PROCESSING_LIMIT"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "AUDIO_TOO_LARGE"
  | "UNSUPPORTED_AUDIO"
  | "NO_SPEECH"
  | "INVALID_AI_OUTPUT"
  | "AI_AUTH_FAILED"
  | "AI_UNAVAILABLE"
  | "AI_PROCESSING_FAILED"
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

export async function readBoundedBody(
  request: Request,
  limit: number,
  tooLarge = new ApiError(
    "AUDIO_TOO_LARGE",
    "Choose audio smaller than 10 MiB.",
    413,
  ),
): Promise<Uint8Array<ArrayBuffer>> {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw tooLarge;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonRequest(request: Request): Promise<unknown> {
  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase() !== "application/json"
  ) {
    throw new ApiError("INVALID_INPUT", "Send a JSON request body.", 400);
  }
  const bytes = await readBoundedBody(
    request,
    1024 * 1024,
    new ApiError("INVALID_INPUT", "The request exceeds the 1 MiB limit.", 413),
  );
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ApiError(
      "INVALID_INPUT",
      "The JSON request could not be read.",
      400,
    );
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
