export async function accountRequest(
  url: string,
  init?: RequestInit,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      "Could not connect. Your changes are still here. Please retry.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof data?.error?.message === "string"
        ? data.error.message
        : "The request could not finish. Please retry.",
    );
  if (!data) throw new Error("The response could not be read. Please retry.");
  return data;
}
