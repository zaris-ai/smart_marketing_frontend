import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useState } from 'react';

const DashboardHomePage = () => {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  const loadLatestDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/dashboard');
      const data = response?.data?.data;

      setHtml(data?.html || '');
      
      setLastUpdated(data?.createdAt || '');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to load latest dashboard'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDashboard = async () => {
    try {
      setGenerating(true);
      setError('');

      const response = await api.post('/dashboard/generate');
      const data = response?.data?.data;

      setHtml(data?.html || '');
      setLastUpdated(data?.createdAt || '');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
        err?.message ||
        'Failed to generate dashboard'
      );
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    loadLatestDashboard();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex items-center justify-between py-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Latest saved AI-generated dashboard page
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {lastUpdated ? new Date(lastUpdated).toLocaleString() : '—'}
              </p>
            </div>

            <Button
              onClick={handleGenerateDashboard}
              // disabled={generating}
            > 
              {generating ? 'Generating...' : 'Generate new dashboard'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading latest dashboard...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : (
          <div
            className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </DashboardLayout>
  );
};


export const getServerSideProps = withAuth();
export default DashboardHomePage;