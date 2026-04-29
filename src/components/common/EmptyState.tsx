/**
 * EmptyState Component - حالت خالی
 * 
 * نمایش پیام‌های خالی با illustration و CTA
 */
import { ReactNode } from 'react';
import { Button } from '../ui';
import {
  FolderOpenIcon,
  MagnifyingGlassIcon,
  ExclamationTriangleIcon,
  InboxIcon,
} from '@heroicons/react/24/outline';

type EmptyStateVariant = 'default' | 'search' | 'error' | 'no-data';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ElementType;
  };
  className?: string;
  children?: ReactNode;
}

const VARIANT_ICONS: Record<EmptyStateVariant, React.ElementType> = {
  default: InboxIcon,
  search: MagnifyingGlassIcon,
  error: ExclamationTriangleIcon,
  'no-data': FolderOpenIcon,
};

const VARIANT_COLORS: Record<EmptyStateVariant, string> = {
  default: 'text-gray-400 dark:text-gray-600',
  search: 'text-blue-400 dark:text-blue-600',
  error: 'text-red-400 dark:text-red-600',
  'no-data': 'text-purple-400 dark:text-purple-600',
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'default',
  icon: CustomIcon,
  title,
  description,
  action,
  className = '',
  children,
}) => {
  const Icon = CustomIcon || VARIANT_ICONS[variant];
  const iconColor = VARIANT_COLORS[variant];

  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}
    >
      {/* Icon با Animation */}
      <div className="mb-6 animate-fade-in">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-purple-500/20 dark:from-primary/30 dark:to-purple-500/30 rounded-full blur-2xl opacity-50" />
          <Icon className={`relative w-16 h-16 lg:w-20 lg:h-20 ${iconColor}`} />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2 animate-fade-in-up">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400 max-w-md mb-6 animate-fade-in-up animation-delay-100">
          {description}
        </p>
      )}

      {/* Action Button */}
      {action && (
        <Button
          onClick={action.onClick}
          className="animate-fade-in-up animation-delay-200 inline-flex items-center gap-2"
        >
          {action.icon && <action.icon className="w-4 h-4" />}
          {action.label}
        </Button>
      )}

      {/* Custom Children */}
      {children && (
        <div className="mt-6 animate-fade-in-up animation-delay-300">
          {children}
        </div>
      )}
    </div>
  );
};
