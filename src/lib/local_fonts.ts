import localFont from 'next/font/local';

/**
 * فونت یکان بخ با وزن‌های بهینه شده
 * فقط ۳ وزن اصلی برای بهبود Performance
 */
export const yekan = localFont({
  src: [
    {
      path: '../../public/Font/YekanBakhFaNum-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/Font/YekanBakhFaNum-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../public/Font/YekanBakhFaNum-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
  ],
  variable: '--font-yekan',
  display: 'swap',
  preload: true,
  fallback: ['Tahoma', 'Arial', 'sans-serif'],
  adjustFontFallback: 'Arial',
})