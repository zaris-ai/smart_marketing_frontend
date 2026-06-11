// ============================================
// App Component - کامپوننت اصلی اپلیکیشن
// ============================================

import '@/styles/globals.css';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/common';
import { yekan } from '@/lib/local_fonts';
import { Toaster } from 'sonner';
import { useState } from 'react';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <SessionProvider session={session}>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <Toaster
            position="top-center"
            toastOptions={{
              className: 'font-yekan',
              style: {
                fontFamily: 'var(--font-yekan)',
              },
            }}
            richColors
          />
          <main className={yekan.variable}>
            <Component {...pageProps} />
          </main>
        </ErrorBoundary>
      </QueryClientProvider>
    </SessionProvider>
  );
}
