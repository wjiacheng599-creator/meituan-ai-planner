import { type ReactNode, memo } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
}

const VARIANT_CLASSES = {
  primary: 'bg-[var(--brand-ink)] text-white hover:bg-[var(--brand-ink)]/90 active:scale-[0.98]',
  secondary:
    'bg-[var(--brand-light)] text-[var(--brand-ink)] hover:bg-[var(--brand-light)]/80 active:scale-[0.98]',
  outline:
    'border-2 border-[var(--brand-ink)] text-[var(--brand-ink)] hover:bg-[var(--brand-ink)]/5 active:scale-[0.98]',
  ghost: 'text-[var(--brand-ink)] hover:bg-gray-100 active:scale-[0.98]',
};

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-12 px-6 text-[13px]',
};

export const Button = memo(function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-bold rounded-xl
        transition-all duration-200 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${VARIANT_CLASSES[variant]}
        ${SIZE_CLASSES[size]}
        ${className}
      `}
    >
      {loading ? (
        <>
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <span>加载中</span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export const Input = memo(function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  className = '',
  disabled = false,
  error,
}: InputProps) {
  return (
    <div className="relative">
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`
          w-full h-11 px-4 rounded-xl border-2
          font-medium text-[13px]
          bg-white
          placeholder:text-gray-300
          focus:outline-none focus:border-[var(--brand-ink)] focus:ring-2 focus:ring-[var(--brand-ink)]/20
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200
          ${error ? 'border-red-400' : 'border-gray-200'}
          ${className}
        `}
      />
      {error && <p className="mt-1.5 text-[13px] font-bold text-red-500">{error}</p>}
    </div>
  );
});

interface CardProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  hoverable?: boolean;
}

export const Card = memo(function Card({
  children,
  onClick,
  className = '',
  hoverable = false,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white rounded-2xl shadow-sm
        ${hoverable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]' : ''}
        transition-all duration-200
        ${className}
      `}
    >
      {children}
    </div>
  );
});
