import { Button, Input } from '@/components/ui';
import { LockClosedIcon, UserIcon } from '@heroicons/react/24/outline';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await signIn('credentials', {
        username: data.username,
        password: data.password,
        redirect: false,
      });
      
      if (!result) {
        setError('No response from authentication service.');
        return;
      }

      if (result.error) {
        setError(result.error);
        return;
      }

      await router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left" dir="ltr">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm whitespace-pre-line">
          {error}
        </div>
      )}

      <Input
        {...register('username')}
        type="text"
        label="Username"
        placeholder="Enter your username"
        error={errors.username?.message}
        leftIcon={<UserIcon className="w-5 h-5" />}
        dir="ltr"
        autoComplete="username"
        autoFocus
      />

      <Input
        {...register('password')}
        type="password"
        label="Password"
        placeholder="Enter your password"
        error={errors.password?.message}
        leftIcon={<LockClosedIcon className="w-5 h-5" />}
        dir="ltr"
        autoComplete="current-password"
      />

      <Button type="submit" fullWidth isLoading={isLoading}>
        Login
      </Button>
    </form>
  );
};

export default LoginForm;