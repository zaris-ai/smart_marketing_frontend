import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

export const LandingHeader: React.FC = () => {
  const { status } = useSession()
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled
        ? 'bg-white/95 dark:bg-gray-900/95'
        : 'bg-transparent'
        }`}
    >
      <nav className="container mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          <Link href="/" className="flex items-center gap-3 group relative">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#1D3D6B] to-[#2A4F7E] blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
              <div className="relative w-12 h-12 bg-gradient-to-br from-[#1D3D6B] to-[#2A4F7E] rounded-2xl flex items-center justify-center shadow-xl transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <span className="text-white font-black text-2xl">A</span>
              </div>
            </div>

            <div className="hidden sm:block">
              <h1
                className={`text-2xl font-black transition-colors duration-300 ${scrolled ? 'text-gray-900 dark:text-white' : 'text-black dark:text-white'
                  }`}
              >
                ARKA
              </h1>
              <p
                className={`text-xs font-medium transition-colors duration-300 ${scrolled
                  ? 'text-gray-500 dark:text-gray-400'
                  : 'text-black/90 dark:text-gray-300'
                  }`}
              >
                Admin Panel
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            
            {
              status === "authenticated" ?
                <Link
                  href="/dashboard"
                  className="hidden md:block px-6 py-2.5 font-bold rounded-xl transition-all duration-300 transform hover:scale-105 text-gray-800 dark:text-gray-300 hover:text-[#1D3D6B] dark:hover:text-[#4A7BA7]"
                >
                  Dashboard
                </Link> :
                <Link
                  href="/auth/login"
                  className="hidden md:block px-6 py-2.5 font-bold rounded-xl transition-all duration-300 transform hover:scale-105 text-gray-800 dark:text-gray-300 hover:text-[#1D3D6B] dark:hover:text-[#4A7BA7]"
                >
                  Login
                </Link>
            }
          </div>
        </div>
      </nav>
    </header>
  );
};