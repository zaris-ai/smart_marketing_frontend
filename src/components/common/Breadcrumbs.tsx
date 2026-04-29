/**
 * Breadcrumbs Component - مسیر یابی
 * 
 * نمایش مسیر فعلی کاربر در سیستم با قابلیت navigation
 */
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';

interface BreadcrumbItem {
  label: string;
  href: string;
  icon?: React.ElementType;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

// مپ کردن route segments به لیبل فارسی
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'داشبورد',
  datasets: 'مجموعه‌های داده',
  users: 'کاربران',
  'special-access': 'دسترسی خاص',
  'add-special-access': 'افزودن دسترسی',
  profile: 'پروفایل',
  settings: 'تنظیمات',
  'role-permissions': 'نقش‌ها و دسترسی‌ها',
  admin: 'مدیریت',
  teams: 'تیم‌ها',
  roles: 'نقش‌ها',
};

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items: customItems, className = '' }) => {
  const router = useRouter();

  const items = useMemo(() => {
    if (customItems) return customItems;

    // Auto-generate از pathname
    const pathSegments = router.pathname.split('/').filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'خانه', href: '/dashboard', icon: HomeIcon },
    ];

    let currentPath = '';
    pathSegments.forEach((segment, index) => {
      // Skip dynamic segments مثل [userId]
      if (segment.startsWith('[')) return;

      currentPath += `/${segment}`;
      const label = ROUTE_LABELS[segment] || segment;
      
      breadcrumbs.push({
        label,
        href: currentPath,
      });
    });

    return breadcrumbs;
  }, [customItems, router.pathname]);

  if (items.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-2 text-sm ${className}`}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const Icon = item.icon;

        return (
          <div key={item.href} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronLeftIcon className="w-4 h-4 text-gray-400 dark:text-gray-600 rotate-180" />
            )}
            
            {isLast ? (
              <span className="flex items-center gap-1.5 text-gray-900 dark:text-gray-100 font-medium">
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {Icon && <Icon className="w-4 h-4" />}
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
};
