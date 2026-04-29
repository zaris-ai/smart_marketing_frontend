// ============================================
// Theme Toggle Component - دکمه تغییر تم
// ============================================

import { useEffect, useState } from 'react';
import { useThemeStore } from '@/stores/theme.store';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { cn } from '@/utils/cn';

interface ThemeToggleProps {
  className?: string;
  variant?: 'icon' | 'button' | 'dropdown';
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className, variant = 'icon' }) => {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setMounted(true);
    // تشخیص تم سیستم
    const updateSystemTheme = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setSystemTheme(isDark ? 'dark' : 'light');
    };
    
    updateSystemTheme();
    
    // گوش دادن به تغییرات تم سیستم
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', updateSystemTheme);
    
    return () => mediaQuery.removeEventListener('change', updateSystemTheme);
  }, []);

  const handleToggle = () => {
    toggleTheme();
  };

  const handleThemeSelect = (selectedTheme: 'light' | 'dark' | 'system') => {
    setTheme(selectedTheme);
    setIsOpen(false);
  };

  // جلوگیری از hydration mismatch
  if (!mounted) {
    return (
      <button className={cn('p-2 rounded-lg bg-base-200', className)} aria-label="تغییر تم">
        <div className="w-5 h-5" />
      </button>
    );
  }

  const getThemeIcon = (themeValue: 'light' | 'dark' | 'system') => {
    if (themeValue === 'dark') return <MoonIcon className="w-5 h-5" />;
    if (themeValue === 'light') return <SunIcon className="w-5 h-5" />;
    return <ComputerDesktopIcon className="w-5 h-5" />;
  };

  const getThemeLabel = (themeValue: 'light' | 'dark' | 'system') => {
    if (themeValue === 'dark') return 'حالت شب';
    if (themeValue === 'light') return 'حالت روز';
    // برای حالت سیستم، نشان بده که الان چه تمی فعاله
    return `حالت سیستم (${systemTheme === 'dark' ? 'شب' : 'روز'})`;
  };

  // Dropdown variant with all 3 options
  if (variant === 'dropdown') {
    return (
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
            'bg-base-200 hover:bg-base-300',
            'text-base-content',
            className
          )}
          aria-label="تغییر تم"
        >
          <div className="relative">
            {getThemeIcon(theme)}
            {theme === 'system' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-white dark:ring-gray-800" />
            )}
          </div>
          <span className="text-sm">{getThemeLabel(theme)}</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden z-20">
              <button
                onClick={() => handleThemeSelect('light')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  theme === 'light'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                )}
              >
                <SunIcon className="w-5 h-5" />
                <span>حالت روز</span>
              </button>
              <button
                onClick={() => handleThemeSelect('dark')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  theme === 'dark'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                )}
              >
                <MoonIcon className="w-5 h-5" />
                <span>حالت شب</span>
              </button>
              <button
                onClick={() => handleThemeSelect('system')}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  theme === 'system'
                    ? 'bg-primary/10 text-primary dark:bg-primary/20'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                )}
              >
                <ComputerDesktopIcon className="w-5 h-5" />
                <div className="flex flex-col items-start">
                  <span>حالت سیستم</span>
                  <span className="text-xs opacity-70">
                    ({systemTheme === 'dark' ? 'شب' : 'روز'})
                  </span>
                </div>
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
          'bg-base-200 hover:bg-base-300',
          'text-base-content',
          className
        )}
        aria-label="تغییر تم"
      >
        <div className="relative">
          {getThemeIcon(theme)}
          {theme === 'system' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-white dark:ring-gray-800" />
          )}
        </div>
        <span>{getThemeLabel(theme)}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className={cn(
        'p-2 rounded-lg transition-colors relative',
        'bg-base-200 hover:bg-base-300',
        'text-base-content',
        className
      )}
      aria-label="تغییر تم"
      title={getThemeLabel(theme)}
    >
      {getThemeIcon(theme)}
      {theme === 'system' && (
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary ring-1 ring-white dark:ring-gray-800" />
      )}
    </button>
  );
};

export default ThemeToggle;
