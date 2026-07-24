"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function getJson<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      error?.message ?? "데이터를 불러오지 못했습니다.",
      response.status,
      error?.code,
    );
  }

  return (await response.json()) as T;
}

export async function postJson<TInput, TResponse>(
  path: string,
  body: TInput,
  signal?: AbortSignal,
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      error?.message ?? "요청을 처리하지 못했습니다.",
      response.status,
      error?.code,
    );
  }

  return (await response.json()) as TResponse;
}
