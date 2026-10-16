export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_MAX_ATTEMPTS = 5;

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
/** Sliding: each refresh issues a token valid for another 90 days. */
export const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const DEVICE_LIMIT_TOKEN_TTL_SECONDS = 10 * 60;

export const MAX_ACTIVE_DEVICES = 2;

/** Don't write last_active_at on every request. */
export const ACTIVITY_WRITE_INTERVAL_MS = 5 * 60 * 1000;

/** Staff (admin/reviewer) must re-enter a TOTP code this often per device. */
export const MFA_WINDOW_MS = 12 * 60 * 60 * 1000;
