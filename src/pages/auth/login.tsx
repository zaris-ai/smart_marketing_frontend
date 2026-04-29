import { AuthLayout } from '@/components/layouts';
import { LoginForm } from '@/components/auth';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const LoginPage = () => {
  const { status } = useSession()
  const { push } = useRouter()
  useEffect(() => {
    if (status === 'authenticated') {
      push('/dashboard')
    }
  }, [status])
  return (
    <AuthLayout
      title="Login to your account"
      subtitle="Welcome back. Please enter your username and password."
    >
      <LoginForm />
    </AuthLayout>
  );
};


export default LoginPage;