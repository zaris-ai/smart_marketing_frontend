// ============================================
// ErrorBoundary - مدیریت خطاهای React
// ============================================

'use client';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary - جلوگیری از crash کل اپلیکیشن
 * 
 * استفاده:
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console در development
    if (process.env.NODE_ENV === 'development') {
      console.error('❌ ErrorBoundary caught an error:', error, errorInfo);
    }

    // TODO: ارسال error به سرویس monitoring (مثل Sentry)
    // logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // اگر fallback دلخواه داده شده، آن را نمایش بده
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI پیش‌فرض برای خطا
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
              {/* Icon */}
              <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                <XCircleIcon className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>

              {/* Title */}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
                مشکلی پیش آمده!
              </h1>

              {/* Description */}
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                متأسفانه خطایی در اجرای برنامه رخ داده است. لطفاً صفحه را مجدداً بارگذاری کنید.
              </p>

              {/* Error details در development */}
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="mb-6 text-right bg-red-50 dark:bg-red-900/10 rounded-lg p-4 max-h-48 overflow-auto">
                  <p className="text-sm font-mono text-red-600 dark:text-red-400 break-all">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-900 dark:hover:text-gray-200">
                        Stack trace
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-all">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={this.handleReset}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
                >
                  تلاش مجدد
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-3 bg-[#0465a0] text-white rounded-lg hover:bg-[#1D3D6B] transition-colors font-medium flex items-center gap-2"
                >
                  <ArrowPathIcon className="w-5 h-5" />
                  بازگشت به خانه
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
