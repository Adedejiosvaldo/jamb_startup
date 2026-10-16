import Link from 'next/link';

export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="sc-mark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6ee7b7" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#sc-mark)" />
      {/* Rising score arc */}
      <path
        d="M8 21.5a8.5 8.5 0 0 1 16 -4"
        fill="none"
        stroke="#04130d"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="24" cy="17.5" r="2.6" fill="#04130d" />
    </svg>
  );
}

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2.5 text-[15px] font-semibold text-fg"
    >
      <LogoMark />
      ScoreCoach
    </Link>
  );
}
