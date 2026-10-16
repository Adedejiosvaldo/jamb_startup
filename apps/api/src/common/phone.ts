/**
 * Nigerian mobile number normalisation (F-ACC-01).
 *
 * Accepts local (08031234567), international (+2348031234567 / 2348031234567)
 * and spaced/dashed forms. Returns E.164 (+234XXXXXXXXXX) or null.
 *
 * Allowed prefixes per spec: 070, 080, 081, 090, 091.
 * [VERIFY] NCC also allocates 0702x/0704x/0707x (inside 070) and newer ranges
 * such as 0703x/0706x — those are covered by the 070 prefix. Extend this list
 * if real users hit numbers outside it (e.g. 071, 095).
 */
const ALLOWED_PREFIXES = ['70', '80', '81', '90', '91'] as const;

export function normaliseNigerianPhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, '');
  let national: string;
  if (/^\+234\d{10}$/.test(digits)) national = digits.slice(4);
  else if (/^234\d{10}$/.test(digits)) national = digits.slice(3);
  else if (/^0\d{10}$/.test(digits)) national = digits.slice(1);
  else return null;

  if (!ALLOWED_PREFIXES.some((p) => national.startsWith(p))) return null;
  return `+234${national}`;
}

/** +2348031234567 → 0803 *** 4567 — safe for logs and UI. */
export function maskPhone(e164: string): string {
  const local = `0${e164.slice(4)}`;
  return `${local.slice(0, 4)} *** ${local.slice(-4)}`;
}
