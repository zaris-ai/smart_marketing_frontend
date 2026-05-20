import { DashboardHeader, DashboardSidebar } from '@/components/dashboard';
import { cn, getLogoutUrl } from '@/utils';
import { signOut } from 'next-auth/react';
import { ReactNode, useState } from 'react';
import PanelAgentChatbot from '../PanelAgentChatbot';

interface DashboardLayoutProps {
  children: ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsedSidebar, setCollapsedSidebar] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const [notificationDropdown, setNotificationDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');


  const handleLogout = async () => {
    await signOut({ callbackUrl: getLogoutUrl() });
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors p-4">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <DashboardSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        collapsedSidebar={collapsedSidebar}
        setCollapsedSidebar={setCollapsedSidebar}
      />

      {/* Main Content */}
      <div
        className={cn(
          'transition-all duration-300',
          collapsedSidebar ? 'lg:ml-24' : 'lg:ml-76'
        )}
      >
        {/* Header */}
        <DashboardHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          setSidebarOpen={setSidebarOpen}
          notificationDropdown={notificationDropdown}
          setNotificationDropdown={setNotificationDropdown}
          profileDropdown={profileDropdown}
          setProfileDropdown={setProfileDropdown}
          onLogout={handleLogout}
        />

        {/* Page Content */}
        <main className="p-6 mt-4">{children}</main>
      </div>
      <PanelAgentChatbot />
    </div>
  );
};

export default DashboardLayout;
