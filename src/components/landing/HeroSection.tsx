import { IconArrowRight } from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

export const HeroSection: React.FC = () => {
  const { status } = useSession()


  return (
    <section className="relative min-h-[100vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pt-32 pb-20">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 overflow-hidden opacity-40 dark:opacity-20">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Animated Orbs */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#0465a0]/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-[#f6a332]/10 rounded-full blur-3xl animate-float animation-delay-400" />
      </div>

      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-8 opacity-0 animate-fade-in-up">
            {/* Main Heading */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 dark:text-white leading-[1.1] tracking-tight max-w-5xl mx-auto">
              Smart Operations,
              <span className="block mt-2 text-[#0465a0]">
                Powered by Arka
              </span>
              <span className="block mt-2 text-gray-700 dark:text-gray-300">
                Admin Panel
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-base md:text-lg text-gray-600 dark:text-gray-400 leading-relaxed max-w-3xl mx-auto font-medium">
              Manage your teams, workflows, and operational processes in one unified platform.
              <br className="hidden md:block" />
              <span className="text-[#0465a0] font-bold">Arka Admin Panel</span> gives you clear control,
              better visibility, and faster execution across your organization.
            </p>

            {/* CTA Button */}
            {
              status === 'authenticated' ?
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 opacity-0 animate-fade-in-up animation-delay-400">
                  <Link
                    href="/dashboard"
                    className="group relative px-10 py-4 bg-[#0465a0] hover:bg-[#055a8a] text-white font-bold text-base rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center justify-center gap-3 overflow-hidden min-w-[220px]"
                  >
                    <span>Dashboard</span>
                    <IconArrowRight
                      className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300"
                      stroke={2}
                    />
                  </Link>
                </div>

                :
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4 opacity-0 animate-fade-in-up animation-delay-400">
                  <Link
                    href="/auth/login"
                    className="group relative px-10 py-4 bg-[#0465a0] hover:bg-[#055a8a] text-white font-bold text-base rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 flex items-center justify-center gap-3 overflow-hidden min-w-[220px]"
                  >
                    <span>Get Started</span>
                    <IconArrowRight
                      className="w-5 h-5 group-hover:translate-x-2 transition-transform duration-300"
                      stroke={2}
                    />
                  </Link>
                </div>
            }
          </div>
        </div>
      </div>
    </section>
  );
};