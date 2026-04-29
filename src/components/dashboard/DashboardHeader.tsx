// ============================================
// Dashboard Header - هدر داشبورد
// ============================================

import { ThemeToggle } from '@/components/common';
import {
  Bars3Icon
} from '@heroicons/react/24/outline';
import { signOut, useSession } from 'next-auth/react';

interface DashboardHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSidebarOpen: (open: boolean) => void;
  notificationDropdown: boolean;
  setNotificationDropdown: (open: boolean) => void;
  profileDropdown: boolean;
  setProfileDropdown: (open: boolean) => void;
  onLogout: () => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  setSidebarOpen,
}) => {
  const { data } = useSession()
  const userName = data?.user.username;

  return (
    <header className="h-20 mx-2 rounded rounded-sm bg-white dark:from-gray-900 dark:via-gray-800/50 dark:bg-gray-900 border-gray-200/50 dark:border-gray-700/50 sticky top-4 z-30  backdrop-blur-md">
      <div className="h-full px-6 flex items-center justify-between gap-6">
        {/* Mobile Menu Button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-300 hover:scale-105"
        >
          <Bars3Icon className="w-6 h-6" />
        </button>


        {/* Header Actions */}
        <div className="flex items-center gap-1.5">

          {/* Theme Toggle */}
          {/* <div className="p-0.5">
            <ThemeToggle />
          </div> */}
          <div className="flex justify-start items-center gap-2">
            <div className="avatar">
              <div className="ring-primary ring-offset-base-100 w-8 rounded-full">
                <img src="https://img.daisyui.com/images/profile/demo/spiderperson@192.webp" />
              </div>
            </div>
            <p>{userName}</p>
          </div>

        </div>
        <button onClick={() => signOut({ callbackUrl: '/auth/login' })}>
          Logout
        </button>
      </div>
    </header>
  );
};
