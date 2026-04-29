// ============================================
// Theme Provider - مدیریت تم در سطح اپلیکیشن
// ============================================

import { useEffect } from 'react';
import { useThemeStore } from '@/stores/theme.store';

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useThemeStore((state) => state.theme);

  // اعمال تم اولیه از localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-storage');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        const savedThemeValue = parsed.state?.theme || 'system';
        const actualTheme = savedThemeValue === 'system' ? getSystemTheme() : savedThemeValue;
        document.documentElement.setAttribute('data-theme', actualTheme);
        if (actualTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (error) {
        console.error('Error parsing theme from localStorage:', error);
      }
    } else {
      // اگر ذخیره نشده، از تم سیستم استفاده کن
      const systemTheme = getSystemTheme();
      document.documentElement.setAttribute('data-theme', systemTheme);
      if (systemTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  // اعمال تغییرات تم
  useEffect(() => {
    const actualTheme = theme === 'system' ? getSystemTheme() : theme;
    document.documentElement.setAttribute('data-theme', actualTheme);
    if (actualTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // گوش دادن به تغییرات تم سیستم
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const systemTheme = getSystemTheme();
      document.documentElement.setAttribute('data-theme', systemTheme);
      if (systemTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return <>{children}</>;
};
