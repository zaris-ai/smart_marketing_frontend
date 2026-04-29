import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';

type SeoKeywordOpportunityDoc = {
  _id: string;
  websiteUrl: string;
  brandName: string;
  tone: string;
  maxKeywords: number;
  crewName: string;
  resultContent: string;
  tasksOutput: string[];
  status: 'success' | 'failed';
  rawResponse?: any;
  createdAt: string;
  updatedAt: string;
};

const WEBSITE_URL = 'https://web.arkaanalyzer.com/';

const SeoKeywordOpportunityPage = () => {
  const [serverError, setServerError] = useState('');
  const [html, setHtml] = useState('');
  const [latestDoc, setLatestDoc] = useState<SeoKeywordOpportunityDoc | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasResult = useMemo(() => html.trim().length > 0, [html]);

  const fetchLatest = async () => {
    try {
      setIsLoadingLatest(true);
      setServerError('');

      const response = await api.get('/seo-keyword-opportunity/latest');
      const doc = response?.data?.data || null;

      setLatestDoc(doc);
      setHtml(doc?.resultContent || '');
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to fetch latest SEO keyword opportunity report.'
      );
    } finally {
      setIsLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  const onRunCrew = async () => {
    try {
      setIsSubmitting(true);
      setServerError('');

      const response = await api.post('/seo-keyword-opportunity', {
        website_url: WEBSITE_URL,
        brand_name: 'Arka Analyzer',
        tone: 'professional and analytical',
        max_keywords: 12,
      });

      const doc = response?.data?.data || null;

      setLatestDoc(doc);
      setHtml(doc?.resultContent || '');
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to run SEO keyword opportunity crew.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  SEO Keyword Opportunity
                </h1>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  View the latest saved keyword opportunity report first, then generate and save a new one.
                </p>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Website: {WEBSITE_URL}
                </p>

                {latestDoc?.brandName && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Brand: {latestDoc.brandName}
                  </p>
                )}

                {latestDoc?.maxKeywords ? (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Max keywords: {latestDoc.maxKeywords}
                  </p>
                ) : null}

                {latestDoc?.createdAt && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Latest generated: {new Date(latestDoc.createdAt).toLocaleString()}
                  </p>
                )}
              </div>

              <Button type="button" onClick={onRunCrew} isLoading={isSubmitting}>
                Create Keyword Report
              </Button>
            </div>

            {serverError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {serverError}
              </div>
            )}
          </div>

          {isLoadingLatest && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-72 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="h-64 rounded-2xl bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          )}

          {!isLoadingLatest && hasResult && (
            <div
              className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {!isLoadingLatest && !hasResult && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                No saved keyword report yet
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Click the button once and the latest generated keyword opportunity report will be stored in MongoDB.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default SeoKeywordOpportunityPage;