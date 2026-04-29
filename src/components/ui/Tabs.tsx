/**
 * Tabs Component - تب‌های حرفه‌ای با استایل سازمانی
 * 
 * Features:
 * - Accessible (keyboard navigation)
 * - Badge support برای نمایش تعداد
 * - Active state با animation
 * - Responsive design
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/utils';

interface TabItem {
  id: string;
  label: string;
  count?: number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = React.memo(({
  tabs,
  activeTab,
  onTabChange,
  className,
}) => {
  const handleTabClick = useCallback((tabId: string, disabled?: boolean) => {
    if (disabled) return;
    onTabChange(tabId);
  }, [onTabChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, tabId: string, disabled?: boolean) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabChange(tabId);
    }
  }, [onTabChange]);

  return (
    <div className={cn('border-b border-gray-200 dark:border-gray-700', className)}>
      <nav className="-mb-px flex gap-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isDisabled = tab.disabled;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id, isDisabled)}
              onKeyDown={(e) => handleKeyDown(e, tab.id, isDisabled)}
              disabled={isDisabled}
              role="tab"
              aria-selected={isActive}
              aria-disabled={isDisabled}
              className={cn(
                'group relative inline-flex items-center gap-2 px-1 py-4 text-sm font-medium transition-all duration-200',
                'border-b-2 border-transparent',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
                isActive
                  ? 'border-primary text-primary'
                  : isDisabled
                  ? 'cursor-not-allowed text-gray-400 dark:text-gray-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              )}
            >
              <span className={cn(
                'transition-transform duration-200',
                isActive && 'scale-105'
              )}>
                {tab.label}
              </span>
              
              {typeof tab.count === 'number' && (
                <span className={cn(
                  'inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold transition-colors duration-200',
                  isActive
                    ? 'bg-primary text-white'
                    : isDisabled
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 group-hover:bg-gray-200 dark:group-hover:bg-gray-700'
                )}>
                  {tab.count > 999 ? '999+' : tab.count}
                </span>
              )}

              {/* Active indicator animation */}
              {isActive && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary animate-in slide-in-from-left duration-300" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
});

Tabs.displayName = 'Tabs';

export default Tabs;
