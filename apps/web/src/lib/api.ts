import { API_URL } from './config';

export interface Tokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: Record<string, unknown>,
  ) {
    super(message);
  }
}

const TOKENS_KEY = 'sc.tokens';
const DEVICE_KEY = 'sc.device';

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode: tokens live in memory only */
  }
}

let memoryTokens: Tokens | null = null;
const listeners = new Set<() => void>();

// TODO(F-ACC-01 hardening): move the refresh token to an httpOnly cookie once
// web and API share a parent domain.
export function getTokens(): Tokens | null {
  if (memoryTokens) return memoryTokens;
  const raw = safeGet(TOKENS_KEY);
  memoryTokens = raw ? (JSON.parse(raw) as Tokens) : null;
  return memoryTokens;
}

export function setTokens(tokens: Tokens | null) {
  memoryTokens = tokens;
  safeSet(TOKENS_KEY, tokens ? JSON.stringify(tokens) : null);
  listeners.forEach((l) => l());
}

export function onTokensChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Stable random id for this browser; used for the 2-device limit, not tracking. */
export function deviceFingerprint(): string {
  let id = safeGet(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    safeSet(DEVICE_KEY, id);
  }
  return id;
}

export function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
      ? 'iPhone'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac/i.test(ua)
          ? 'Mac'
          : /Linux/i.test(ua)
            ? 'Linux'
            : 'Device';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Browser';
  return `${browser} on ${os}`;
}

let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const t = getTokens();
  if (!t) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: t.refreshToken }),
      });
      if (!res.ok) {
        // Only sign out on a definite rejection, not on network trouble.
        if (res.status === 401) setTokens(null);
        return false;
      }
      setTokens((await res.json()) as Tokens);
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  /** Statuses treated as success (e.g. 409 for the device picker). */
  ok?: number[];
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, ok = [] } = opts;
  const send = async () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['content-type'] = 'application/json';
    const tokens = auth ? getTokens() : null;
    if (tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(
      0,
      'NETWORK',
      'You seem to be offline. Check your connection and try again.',
      {},
    );
  }
  if (res.status === 401 && auth && getTokens()) {
    if (await refreshTokens()) res = await send();
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok && !ok.includes(res.status)) {
    const issues = data.issues as { message: string }[] | undefined;
    const message =
      issues?.[0]?.message ??
      (typeof data.message === 'string' ? data.message : null) ??
      'Something went wrong. Please try again.';
    throw new ApiError(res.status, (data.code as string) ?? 'UNKNOWN', message, data);
  }
  return data as T;
}

export const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : 'Something went wrong. Please try again.';

/** Fire-and-forget analytics (spec §16). Never throws. */
export function track(name: string, props: Record<string, unknown> = {}) {
  let anonId = safeGet('sc.anon');
  if (!anonId) {
    anonId = crypto.randomUUID();
    safeSet('sc.anon', anonId);
  }
  void api('/v1/events', { method: 'POST', body: { name, props, anonId } }).catch(() => undefined);
}

export const storage = { get: safeGet, set: safeSet };
