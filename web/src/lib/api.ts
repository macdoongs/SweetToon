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
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetch(path, {
    signal,
    headers: { Accept: "application/json", ...headers },
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
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    signal,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
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

export async function patchJson<TInput, TResponse>(
  path: string,
  body: TInput,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      error?.message ?? "상태를 변경하지 못했습니다.",
      response.status,
      error?.code,
    );
  }
  return (await response.json()) as TResponse;
}

export async function postFormData<TResponse>(
  path: string,
  formData: FormData,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { Accept: "application/json", ...headers },
    body: formData,
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      error?.message ?? "파일을 올리지 못했습니다.",
      response.status,
      error?.code,
    );
  }
  return (await response.json()) as TResponse;
}

export async function deleteRequest(
  path: string,
  headers: HeadersInit = {},
): Promise<void> {
  const response = await fetch(path, { method: "DELETE", headers });
  if (!response.ok && response.status !== 404) {
    throw new ApiError("임시 파일을 정리하지 못했습니다.", response.status);
  }
}
