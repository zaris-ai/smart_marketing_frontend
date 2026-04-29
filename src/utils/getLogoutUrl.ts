/**
 * getLogoutUrl - تعیین URL مناسب برای logout بر اساس محیط
 * 
 * در production (سرور): https://catalog.tatanext.ir/
 * در development (لوکال): /auth/login
 */

import { ROUTES } from '@/config/constants';

export const getLogoutUrl = (): string => {
  // بررسی NEXT_PUBLIC_APP_URL از environment variables
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  
  // اگر APP_URL تنظیم شده و شامل tatanext.ir است، به root سایت برود
  if (appUrl && appUrl.includes('tatanext.ir')) {
    return appUrl.endsWith('/') ? appUrl : `${appUrl}/`;
  }
  
  // در غیر این صورت (localhost یا development)، به صفحه login برود
  return ROUTES.AUTH.LOGIN;
};

export const isProductionEnvironment = (): boolean => {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return Boolean(appUrl && appUrl.includes('tatanext.ir'));
};
