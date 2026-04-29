import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

type BlogCrewFormData = {
  topic: string;
  audience: string;
  tone: string;
};

const BlogPage = () => {
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState<any>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlogCrewFormData>({
    defaultValues: {
      topic: '',
      audience: 'founder',
      tone: 'direct and practical',
    },
  });

  const onSubmit = async (data: BlogCrewFormData) => {
    try {
      setServerError('');
      setResult(null);

      const response = await api.post('/blogs', {
        topic: data.topic,
        audience: data.audience,
        tone: data.tone,
      });

      setResult(response.data.data.result.content);
    } catch (error: any) {
      console.log(error)
      setServerError(
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to run blog crew.'
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Blog Crew Runner
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Send topic, audience, and tone to generate blog output.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {serverError}
              </div>
            )}

            <Input
              {...register('topic', {
                required: 'Topic is required',
                minLength: {
                  value: 5,
                  message: 'Topic must be at least 5 characters',
                },
              })}
              type="text"
              label="Topic"
              placeholder="How should a SaaS startup price an analytics product?"
              error={errors.topic?.message}
              dir="ltr"
              autoFocus
            />

            <Input
              {...register('audience', {
                required: 'Audience is required',
              })}
              type="text"
              label="Audience"
              placeholder="founder"
              error={errors.audience?.message}
              dir="ltr"
            />

            <Input
              {...register('tone', {
                required: 'Tone is required',
              })}
              type="text"
              label="Tone"
              placeholder="direct and practical"
              error={errors.tone?.message}
              dir="ltr"
            />

            <Button type="submit" isLoading={isSubmitting}>
              Run Blog Crew
            </Button>
          </form>

          {result && (
            <div className="mt-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                Response
              </h2>
              <pre className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default BlogPage;