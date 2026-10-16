import { API_URL } from './config';

export interface Tokens {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface Device {
  id: string;
  label: string | null;
  lastActiveAt: string;
}

export type SignInResponse =
  | { status: 'signed_in'; isNewUser: boolean; user: { id: string; phone: string }; tokens: Tokens }
  | { status: 'device_limit'; pendingToken: string; devices: Device[] };

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

async function post<T>(path: string, body: unknown, okStatuses = [200]): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!okStatuses.includes(res.status)) {
    const issues = data.issues as { message: string }[] | undefined;
    const message =
      issues?.[0]?.message ?? (data.message as string) ?? 'Something went wrong. Please try again.';
    throw new ApiError(res.status, (data.code as string) ?? 'UNKNOWN', message, data);
  }
  return data as T;
}

const DEVICE_KEY = 'sc.device';
const TOKENS_KEY = 'sc.tokens';

/** Stable random id for this browser; used for the 2-device limit, not tracking. */
export function deviceFingerprint(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua)
    ? 'Android'
    : /iPhone|iPad/i.test(ua)
      ? 'iPhone'
      : /Windows/i.test(ua)
        ? 'Windows'
        : /Mac/i.test(ua)
          ? 'Mac'
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

// TODO(F-ACC-01 hardening): move the refresh token to an httpOnly cookie once
// web and API share a parent domain; localStorage is acceptable for the pilot.
export function saveTokens(tokens: Tokens): void {
  localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
}

export function requestOtp(phone: string) {
  return post<{ expiresInSeconds: number; resendInSeconds: number }>('/v1/auth/otp/request', {
    phone,
  });
}

export function verifyOtp(phone: string, code: string) {
  return post<SignInResponse>(
    '/v1/auth/otp/verify',
    {
      phone,
      code,
      device: {
        fingerprint: deviceFingerprint(),
        userAgent: navigator.userAgent,
        label: deviceLabel(),
      },
    },
    [200, 409],
  );
}

export function replaceDevice(pendingToken: string, revokeDeviceId: string) {
  return post<SignInResponse>(
    '/v1/auth/devices/replace',
    { pendingToken, revokeDeviceId },
    [200, 409],
  );
}
