'use client'
// ============================================
// Sidebar Menu - منوی سایدبار حرفه‌ای
// ============================================

import { cn } from '@/utils/cn';
import Link from 'next/link';
import { MenuItem } from './menuItems';

interface SidebarMenuProps {
  menuItems: MenuItem[];
  isActive: (href?: string) => boolean;
  collapsedSidebar: boolean;
}

export const SidebarMenu: React.FC<SidebarMenuProps> = ({
  menuItems,
  isActive,
  collapsedSidebar,
}) => {
  // const { hasAccess, loading } = usePermissions();

  // فیلتر کردن منوها بر اساس دسترسی - DISABLED برای نمایش همه منوها
  const filterByPermission = (items: MenuItem[]) => {
    // موقتاً همه منوها نمایش داده می‌شوند
    return items;

    // return items.filter((item) => {
    //   // اگر منو permissionKey ندارد، همیشه نمایش داده شود
    //   if (!item.permissionKey) return true;
    //   
    //   // اگر در حال بارگذاری permissions است، همه منوها را نمایش بده
    //   if (loading) return true;
    //   
    //   // چک کردن دسترسی
    //   return hasAccess(item.permissionKey);
    // });
  };

  // تقسیم منوها به سه بخش و فیلتر بر اساس permission
  const settingsItems = filterByPermission(menuItems.filter((item) => item.section === 'setting'));
  const topItems = filterByPermission(menuItems.filter((item) => item.section === 'top'));
  const seoItems = filterByPermission(menuItems.filter((item) => item.section === 'seo'));
  const crmItems = filterByPermission(menuItems.filter((item) => item.section === 'crm'));
  const instaItems = filterByPermission(menuItems.filter((item) => item.section === 'instagram'));

  const renderMenuItem = (item: MenuItem) => (
    <Link
      key={item.href}
      href={item.href || '#'}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative',
        isActive(item.href)
          ? 'bg-[#1D3D6B]/10 dark:bg-[#0465a0]/20 text-[#1D3D6B] dark:text-[#4A7BA7]'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      )}
    >
      {/* Active indicator */}
      {isActive(item.href) && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[#0465a0] dark:bg-[#4A7BA7] rounded-l-full" />
      )}

      <div
        className={cn(
          'flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200',
          collapsedSidebar
            ? isActive(item.href)
              ? 'bg-transparent text-[#0465a0] dark:text-[#4A7BA7]'
              : 'bg-transparent text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
            : isActive(item.href)
              ? 'bg-[#0465a0] dark:bg-[#0465a0] text-white'
              : 'bg-transparent text-gray-500 dark:text-gray-400 group-hover:bg-gray-100 dark:group-hover:bg-gray-800 group-hover:text-gray-700 dark:group-hover:text-gray-300'
        )}
      >
        <item.icon className="w-5 h-5" />
      </div>
      {!collapsedSidebar && (
        <span
          className={cn(
            'text-sm transition-all duration-200 flex-1',
            isActive(item.href)
              ? 'font-semibold text-[#0465a0] dark:text-[#4A7BA7]'
              : 'font-medium text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200'
          )}
        >
          {item.label}
        </span>
      )}
      {item.badge && !collapsedSidebar && (
        <span className={cn(
          'text-xs rounded-full px-2 py-0.5 font-semibold',
          isActive(item.href)
            ? 'bg-[#0465a0] dark:bg-[#0465a0] text-white'
            : 'bg-red-500 text-white'
        )}>
          {item.badge}
        </span>
      )}
    </Link>
  );

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">

      <div className="space-y-1 mb-6">
        {settingsItems.map(renderMenuItem)}
      </div>

      {/* جداکننده */}
      {!collapsedSidebar && (
        <div className="px-4 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>
      )}

      {/* بخش بالا */}
      <div className="space-y-1 mb-6">
        {topItems.map(renderMenuItem)}
      </div>

      {/* جداکننده */}
      {!collapsedSidebar && (
        <div className="px-4 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>
      )}

      <div className="space-y-1 mb-6">
        {seoItems.map(renderMenuItem)}
      </div>

      {/* جداکننده */}
      {!collapsedSidebar && (
        <div className="px-4 mb-4">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent" />
        </div>
      )}

      <div className="space-y-1 mb-6">
        {crmItems.map(renderMenuItem)}
      </div>


      <div className="space-y-1 mb-6">
        {instaItems.map(renderMenuItem)}
      </div>

    </nav>
  );
};
