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

export function isUncertainRequestError(reason: unknown): boolean {
  return (
    reason instanceof ApiError &&
    ["NETWORK_ERROR", "INVALID_RESPONSE"].includes(reason.code ?? "")
  );
}

const JSON_REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_REQUEST_TIMEOUT_MS = 60_000;
const NETWORK_ERROR_MESSAGE =
  "네트워크 연결이 불안정합니다. 잠시 뒤 다시 시도해 주세요.";

async function fetchWithTimeout(
  path: string,
  init: RequestInit,
  timeoutMs = JSON_REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutController.signal])
    : timeoutController.signal;

  try {
    return await fetch(path, { ...init, signal });
  } catch (reason) {
    if (init.signal?.aborted) throw reason;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function readJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      "서버 응답을 확인하지 못했습니다. 다시 시도해 주세요.",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

export async function getJson<T>(
  path: string,
  signal?: AbortSignal,
  headers: HeadersInit = {},
): Promise<T> {
  const response = await fetchWithTimeout(path, {
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

  return readJson<T>(response);
}

export async function postJson<TInput, TResponse>(
  path: string,
  body: TInput,
  signal?: AbortSignal,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetchWithTimeout(path, {
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

  return readJson<TResponse>(response);
}

export async function patchJson<TInput, TResponse>(
  path: string,
  body: TInput,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetchWithTimeout(path, {
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
  return readJson<TResponse>(response);
}

export async function putJson<TInput, TResponse>(
  path: string,
  body: TInput,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetchWithTimeout(path, {
    method: "PUT",
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
  return readJson<TResponse>(response);
}

export async function postFormData<TResponse>(
  path: string,
  formData: FormData,
  headers: HeadersInit = {},
): Promise<TResponse> {
  const response = await fetchWithTimeout(
    path,
    {
      method: "POST",
      headers: { Accept: "application/json", ...headers },
      body: formData,
    },
    UPLOAD_REQUEST_TIMEOUT_MS,
  );
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
  return readJson<TResponse>(response);
}

export async function deleteRequest(
  path: string,
  headers: HeadersInit = {},
): Promise<void> {
  const response = await fetchWithTimeout(path, { method: "DELETE", headers });
  if (!response.ok && response.status !== 404) {
    const error = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new ApiError(
      error?.message ?? "임시 파일을 정리하지 못했습니다.",
      response.status,
      error?.code,
    );
  }
}
