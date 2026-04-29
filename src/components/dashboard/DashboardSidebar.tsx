import Link from 'next/link';
import { useRouter } from 'next/router';
import { ROUTES } from '@/config/constants';
import { cn } from '@/utils/cn';
import { XMarkIcon, ChevronLeftIcon } from '@heroicons/react/24/outline';
import { SidebarMenu } from './SidebarMenu';
import { menuItems } from './menuItems';

interface DashboardSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  collapsedSidebar: boolean;
  setCollapsedSidebar: (collapsed: boolean) => void;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  sidebarOpen,
  setSidebarOpen,
  collapsedSidebar,
  setCollapsedSidebar,
}) => {
  const router = useRouter();

  const isActive = (href?: string) => {
    if (!href) return false;

    const [basePath] = href.split('?');

    if (basePath === '/dashboard') {
      return router.pathname === '/dashboard';
    }

    return router.pathname === basePath || router.pathname.startsWith(basePath + '/');
  };

  return (
    <aside
      className={cn(
        'fixed top-4 left-4 h-[calc(100vh-2rem)] rounded z-50 transition-all duration-300 border border-gray-100 dark:border-gray-700/50 flex flex-col',
        'bg-white dark:bg-gray-900',
        collapsedSidebar ? 'w-20' : 'w-72',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}
    >
      {/* Logo */}
      <div className="h-20 flex items-center justify-between px-5 border-b border-gray-200 dark:border-gray-700">
        {!collapsedSidebar && (
          <Link
            href={ROUTES.DASHBOARD.HOME}
            className="flex items-center gap-3 group"
          >
            <div className="w-11 h-11 bg-[#0465a0] rounded-xl flex items-center justify-center text-white shadow-md group-hover:shadow-lg transition-all duration-300 group-hover:scale-105">
              <span className="text-lg font-black">A</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Arka Marketing Panel
              </h1>
            </div>
          </Link>
        )}
        {collapsedSidebar && (
          <div className="w-11 h-11 bg-[#1D3D6B] rounded-xl flex items-center justify-center text-white shadow-md mx-auto">
            <span className="text-lg font-black">A</span>
          </div>
        )}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Menu Items */}
      <SidebarMenu
        menuItems={menuItems}
        isActive={isActive}
        collapsedSidebar={collapsedSidebar}
      />

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsedSidebar(!collapsedSidebar)}
        className="hidden lg:flex absolute -right-6 top-26 bg-white dark:bg-[#1D3D6B]  rounded-full p-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 hover:bg-[#2A4F7E] hover:border-[#2A4F7E]"
      >
        <ChevronLeftIcon
          className={cn(
            'w-4 h-4 text-[#1D3D6B] hover:text-white transition-transform duration-300',
            collapsedSidebar && 'rotate-180'
          )}
        />
      </button>
    </aside>
  );
};
