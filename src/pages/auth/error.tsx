// ============================================
// Auth Error Page - صفحه خطای احراز هویت
// ============================================

import { useRouter } from 'next/router';
import { AuthLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import { ROUTES } from '@/config/constants';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

const AuthErrorPage = () => {
  const router = useRouter();
  const { error } = router.query;

  const errorMessage = typeof error === 'string' 
    ? decodeURIComponent(error) 
    : 'خطای نامشخص در احراز هویت';

  return (
    <AuthLayout
      title="خطا در احراز هویت"
      subtitle="متأسفانه مشکلی پیش آمده است"
    >
      <div className="space-y-6">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <ExclamationTriangleIcon className="w-10 h-10 text-red-600 dark:text-red-400" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              خطا در احراز هویت
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md">
              {errorMessage}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => router.push(ROUTES.AUTH.LOGIN)}
            className="w-full"
          >
            بازگشت به صفحه ورود
          </Button>
          
          <Button
            onClick={() => router.push(ROUTES.HOME)}
            variant="outline"
            className="w-full"
          >
            بازگشت به صفحه اصلی
          </Button>
        </div>

        <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            💡 <strong>راهنما:</strong> اگر این خطا تکرار می‌شود، لطفاً دوباره از ابتدا وارد شوید.
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default AuthErrorPage;
