export default function NarrowLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="bg-glow pointer-events-none absolute inset-x-0 top-0 h-96"
      />
      <div className="relative mx-auto max-w-2xl px-4 py-10 sm:py-14">{children}</div>
    </div>
  );
}
