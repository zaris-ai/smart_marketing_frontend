import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ROUTES } from '@/config/constants';
import { ThemeToggle } from '@/components/common';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  showBackButton = false,
}) => {
  return (
    <div className="min-h-screen flex" dir="ltr">
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-gray-950">
        <div className="w-full max-w-md">
          <div className="flex justify-between items-center mb-8">
            <Link href={ROUTES.HOME} className="inline-block">
              <h1 className="text-3xl font-bold text-primary dark:text-blue-400">Arka</h1>
            </Link>
            <ThemeToggle />
          </div>

          <div className="mb-8 text-left">
            {showBackButton && (
              <button
                onClick={() => window.history.back()}
                className="flex items-center text-gray-600 dark:text-gray-400 hover:text-primary mb-4 transition-colors"
                type="button"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
            )}

            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {title}
            </h2>

            {subtitle && (
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {subtitle}
              </p>
            )}
          </div>

          <div className="space-y-6">{children}</div>

          <p className="text-center text-gray-500 dark:text-gray-400 text-xs mt-8">
            By signing in, you agree to the Terms of Use and Privacy Policy.
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src="/Image/side_image.png"
            alt="Authentication Background"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-primary/60 to-primary/80" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12 text-white">
          <div className="text-center max-w-lg">
            <h2 className="text-4xl font-bold mb-6 drop-shadow-lg">
              Welcome to Arka
            </h2>
            <p className="text-xl text-white/90 mb-8 drop-shadow-md">
              Manage your operations, teams, and workflows from one powerful admin panel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;