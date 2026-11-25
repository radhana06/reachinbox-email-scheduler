import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';
interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean }

const styles: Record<Variant, string> = {
  primary: 'bg-green-600 text-white hover:bg-green-700',
  outline: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-100',
  ghost: 'text-gray-600 hover:bg-gray-100',
};

export function Button({ variant = 'primary', loading, children, className = '', disabled, ...rest }: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={14} />}
      {children}
    </button>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
