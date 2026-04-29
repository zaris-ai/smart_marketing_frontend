/**
 * PageHeader Component - هدر یکپارچه صفحات
 * 
 * یک header حرفه‌ای با breadcrumbs، title، description، و actions
 */
import { ReactNode } from 'react';
import { Breadcrumbs } from './Breadcrumbs';
import Link from 'next/link';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  breadcrumbs?: Array<{ label: string; href: string; icon?: React.ElementType }>;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  icon: Icon,
  actions,
  backHref,
  backLabel = 'بازگشت',
  breadcrumbs,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Breadcrumbs */}
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}

      {/* Main Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          {/* Back Link */}
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 transition-colors group"
            >
              <ArrowRightIcon className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              {backLabel}
            </Link>
          )}

          {/* Title with Icon */}
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10">
                <Icon className="w-5 h-5 text-primary" />
              </div>
            )}
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
          </div>

          {/* Description */}
          {description && (
            <p className="text-sm lg:text-base text-gray-500 dark:text-gray-400 max-w-2xl">
              {description}
            </p>
          )}
        </div>

        {/* Actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 lg:gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
