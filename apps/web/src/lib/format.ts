export const naira = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

export const shortDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });

export const dayMonth = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });

export const dateTime = (d: string | Date) =>
  new Date(d).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

export function minutesLabel(m: number): string {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
