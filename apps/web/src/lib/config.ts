/**
 * Base URL for API calls (all made from the browser). On Vercel the API is the
 * `api` service on the same domain under /api, so the default is relative.
 * Local `pnpm dev` runs the API on :4000 — set NEXT_PUBLIC_API_URL=http://localhost:4000/api.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api';
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';
export const supportWaLink = (text = 'Hello, I need help with ScoreCoach.') =>
  SUPPORT_WHATSAPP ? `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(text)}` : null;
