/**
 * API fetcher with httpOnly cookie auth.
 * - Sends credentials (cookies) on every request
 * - On 401: calls POST /api/auth/refresh, retries original request
 * - Refresh token cookie (path /api/auth) is sent automatically to refresh endpoint
 * - On refresh failure: invokes onUnauthorized
 */

const REFRESH_URL = '/api/auth/refresh';

let refreshPromise: Promise<boolean> | null = null;
let onUnauthorized: (() => void) | null = null;

export function setFetcherUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export type FetcherOptions = Omit<RequestInit, 'credentials'> & {
  /** Skip 401 → refresh → retry. Use for refresh/sign-out themselves. Default false. */
  skipAuthRetry?: boolean;
};

async function doRefresh(): Promise<boolean> {
  const res = await fetch(REFRESH_URL, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.ok) return true;
  onUnauthorized?.();
  return false;
}

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh();
  const ok = await refreshPromise;
  refreshPromise = null;
  return ok;
}

export async function fetcher<T = unknown>(
  url: string,
  options: FetcherOptions = {},
): Promise<{ data: T; res: Response }> {
  const { skipAuthRetry = false, ...init } = options;
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  if (init.body !== undefined && !(init.body instanceof FormData)) {
    headers['Content-Type'] ??= 'application/json';
  }

  const baseInit: RequestInit = {
    credentials: 'include',
    headers,
    ...init,
  };

  let res = await fetch(url, baseInit);

  if (res.status === 401 && !skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(url, baseInit);
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      const text = await res.text();
      body = text ? (JSON.parse(text) as unknown) : undefined;
    } catch {
      body = undefined;
    }
    throw new FetcherError(res.status, res.statusText, body);
  }

  const contentType = res.headers.get('content-type');
  const data =
    contentType?.includes('application/json')
      ? ((await res.json()) as T)
      : (await res.text()) as unknown as T;

  return { data, res };
}

export class FetcherError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, statusText: string, body?: unknown) {
    super(`API ${status}: ${statusText}`);
    this.name = 'FetcherError';
    this.status = status;
    this.body = body;
  }
}
