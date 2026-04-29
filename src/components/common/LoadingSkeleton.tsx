/**
 * LoadingSkeleton Component - اسکلتون لودینگ
 * 
 * Skeleton screens برای بهبود UX در حین بارگذاری
 */
import { ReactNode } from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}) => {
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '100%'),
  };

  return (
    <div
      className={`bg-gray-200 dark:bg-gray-800 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// ─── Preset Skeletons ────────────────────────────────────────────────────────

export const CardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
    <div className="space-y-4">
      <Skeleton variant="rounded" height={20} width="60%" />
      <Skeleton variant="text" height={16} width="80%" />
      <Skeleton variant="text" height={16} width="70%" />
      <div className="flex gap-2 mt-4">
        <Skeleton variant="rounded" height={32} width={80} />
        <Skeleton variant="rounded" height={32} width={100} />
      </div>
    </div>
  </div>
);

export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 4 }) => (
  <tr className="border-t border-gray-100 dark:border-gray-800">
    {Array.from({ length: columns }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <Skeleton variant="text" height={16} />
      </td>
    ))}
  </tr>
);

export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4,
}) => (
  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    {/* Header */}
    <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" height={14} width={100} />
        ))}
      </div>
    </div>
    {/* Rows */}
    <table className="w-full">
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </tbody>
    </table>
  </div>
);

export const DatasetCardSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-6 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 ${className}`}>
    {/* Header */}
    <div className="flex items-start justify-between mb-4">
      <div className="flex-1">
        <Skeleton variant="rounded" height={24} width="70%" className="mb-2" />
        <Skeleton variant="text" height={14} width="40%" />
      </div>
      <Skeleton variant="circular" width={40} height={40} />
    </div>
    
    {/* Badges */}
    <div className="flex gap-2 mb-4">
      <Skeleton variant="rounded" height={24} width={80} />
      <Skeleton variant="rounded" height={24} width={100} />
    </div>

    {/* Description */}
    <div className="space-y-2 mb-4">
      <Skeleton variant="text" height={14} width="100%" />
      <Skeleton variant="text" height={14} width="90%" />
    </div>

    {/* Footer */}
    <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
      <Skeleton variant="text" height={12} width={100} />
      <Skeleton variant="rounded" height={32} width={120} />
    </div>
  </div>
);

interface LoadingOverlayProps {
  message?: string;
  children?: ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message = 'در حال بارگذاری...',
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
      <div className="mb-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary to-purple-600 animate-spin">
          <div className="w-12 h-12 rounded-full bg-white dark:bg-gray-900" />
        </div>
      </div>
      <p className="text-gray-900 dark:text-gray-100 font-medium mb-2">{message}</p>
      {children}
    </div>
  </div>
);
