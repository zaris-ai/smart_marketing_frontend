// ============================================
// Input Component - کامپوننت ورودی با Floating Label
// ============================================

import { InputHTMLAttributes, forwardRef, useState } from 'react';
import { cn } from '@/utils/cn';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      disabled,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full">
        <div className="relative">
          {leftIcon && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'w-full px-4 pt-6 pb-2 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary',
              'disabled:bg-gray-100 dark:disabled:bg-gray-900 disabled:cursor-not-allowed',
              'peer',
              error
                ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500'
                : 'border-gray-300 dark:border-gray-700',
              leftIcon && 'pr-10',
              (rightIcon || isPassword) && 'pl-10',
              className
            )}
            disabled={disabled}
            placeholder={placeholder || ' '}
            {...props}
          />
          
          {label && (
            <label
              className={cn(
                'absolute right-4 transition-all duration-200 pointer-events-none',
                'text-gray-500 dark:text-gray-400',
                'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-sm',
                'peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-medium',
                'top-1.5 translate-y-0 text-xs font-medium',
                leftIcon && 'peer-placeholder-shown:right-10 peer-focus:right-4 right-4',
                error && 'text-red-500'
              )}
            >
              {label}
            </label>
          )}
          
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 z-10"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeSlashIcon className="w-5 h-5" />
              ) : (
                <EyeIcon className="w-5 h-5" />
              )}
            </button>
          )}
          {rightIcon && !isPassword && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 z-10">
              {rightIcon}
            </span>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {hint && !error && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
