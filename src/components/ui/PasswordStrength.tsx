// ============================================
// Password Strength Indicator - نشانگر قدرت رمز عبور
// ============================================

import { useMemo } from 'react';
import { cn } from '@/utils/cn';

interface PasswordStrengthProps {
  password: string;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '' };

    let score = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[@$!%*?&#]/.test(password),
    };

    score = Object.values(checks).filter(Boolean).length;

    if (score <= 2) {
      return { score, label: 'ضعیف', color: 'bg-red-500' };
    } else if (score === 3 || score === 4) {
      return { score, label: 'متوسط', color: 'bg-yellow-500' };
    } else {
      return { score, label: 'قوی', color: 'bg-green-500' };
    }
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((level) => (
          <div
            key={level}
            className={cn(
              'h-1 flex-1 rounded-full transition-all',
              level <= strength.score ? strength.color : 'bg-gray-300 dark:bg-gray-700'
            )}
          />
        ))}
      </div>
      <div className="flex justify-between items-center text-xs">
        <span className="text-gray-600 dark:text-gray-400">
          قدرت رمز عبور: <span className="font-medium">{strength.label}</span>
        </span>
      </div>
      <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
        <li className={password.length >= 8 ? 'text-green-600' : ''}>
          • حداقل ۸ کاراکتر
        </li>
        <li className={/[a-z]/.test(password) ? 'text-green-600' : ''}>
          • شامل حروف کوچک
        </li>
        <li className={/[A-Z]/.test(password) ? 'text-green-600' : ''}>
          • شامل حروف بزرگ
        </li>
        <li className={/\d/.test(password) ? 'text-green-600' : ''}>
          • شامل اعداد
        </li>
        <li className={/[@$!%*?&#]/.test(password) ? 'text-green-600' : ''}>
          • شامل کاراکتر خاص (@$!%*?&#)
        </li>
      </ul>
    </div>
  );
};

export default PasswordStrength;
