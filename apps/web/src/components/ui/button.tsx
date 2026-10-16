import Link from 'next/link';
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap transition-[background-color,border-color,color,opacity] duration-150 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40';
const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-emerald-300 to-emerald-500 text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-8px_rgb(16_185_129/0.5)] hover:from-emerald-200 hover:to-emerald-400',
  secondary: 'border border-line-strong bg-white/[0.04] text-fg hover:bg-white/[0.08]',
  ghost: 'text-fg-2 hover:bg-white/[0.06] hover:text-fg',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};
const sizes: Record<Size, string> = {
  sm: 'min-h-9 px-3.5 text-sm',
  md: 'min-h-11 px-5 text-[15px]',
  lg: 'min-h-13 px-6 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    block,
    className,
    children,
    disabled,
    type = 'button',
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, cn(block && 'w-full', className))}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {children}
    </button>
  );
});

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  block,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; block?: boolean }) {
  return (
    <Link className={buttonClass(variant, size, cn(block && 'w-full', className))} {...props} />
  );
}
