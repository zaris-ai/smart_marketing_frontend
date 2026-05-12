import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

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
  telegram?: {
    published?: boolean;
    channelId?: string;
    messageIds?: number[];
    publishedAt?: string | null;
    error?: string;
  };
};

type BackgroundRun = {
  _id: string;
  crewName: string;
  title?: string;
  status: RunStatus;
  result?: any;
  error?: {
    message?: string;
    stack?: string;
  };
  savedRecord?: {
    model?: string | null;
    id?: string | null;
  } | null;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

const WEBSITE_URL = 'https://web.arkaanalyzer.com/';

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

const SeoKeywordOpportunityPage = () => {
  const [serverError, setServerError] = useState('');
  const [html, setHtml] = useState('');
  const [latestDoc, setLatestDoc] =
    useState<SeoKeywordOpportunityDoc | null>(null);

  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus | ''>('');

  const hasResult = useMemo(() => html.trim().length > 0, [html]);

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';
    if (runStatus === 'cancelled') return 'Cancelled';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

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
        getErrorMessage(
          error,
          'Failed to fetch latest SEO keyword opportunity report.'
        )
      );
    } finally {
      setIsLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${runId}`);
        const run: BackgroundRun | undefined = response?.data?.data;

        if (!run) return;

        setRunStatus(run.status);

        if (run.status === 'success') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          await fetchLatest();

          toast.success('SEO keyword opportunity report completed and saved.');

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          const message =
            run?.error?.message ||
            'SEO keyword opportunity background task failed.';

          setServerError(message);
          toast.error(message);

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'cancelled') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          const message =
            run?.error?.message ||
            'SEO keyword opportunity task was cancelled.';

          setServerError(message);
          toast.error('SEO keyword opportunity task was cancelled.');

          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);

        setIsBackgroundRunning(false);
        setIsSubmitting(false);

        const message = getErrorMessage(
          error,
          'Keyword opportunity task completed, but the result could not be loaded.'
        );

        setServerError(message);
        toast.error(message);

        setRunId('');
        setRunStatus('');
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [runId]);

  const onRunCrew = async () => {
    try {
      setIsSubmitting(true);
      setIsBackgroundRunning(false);
      setServerError('');
      setRunId('');
      setRunStatus('');

      const response = await api.post('/seo-keyword-opportunity', {
        website_url: WEBSITE_URL,
        brand_name: 'Arka Analyzer',
        tone: 'professional and analytical',
        max_keywords: 12,
      });

      const responseData = response?.data?.data;

      const nextRunId = responseData?.runId;
      const nextStatus = responseData?.status || 'queued';

      if (nextRunId) {
        setRunId(nextRunId);
        setRunStatus(nextStatus);
        setIsBackgroundRunning(true);

        toast.success(
          response?.data?.message ||
            'SEO keyword opportunity report started in background.'
        );

        return;
      }

      // Backward compatibility if backend still returns completed doc.
      const doc = responseData || null;

      setLatestDoc(doc);
      setHtml(doc?.resultContent || '');
    } catch (error: any) {
      console.log(error);

      const message = getErrorMessage(
        error,
        'Failed to start SEO keyword opportunity crew.'
      );

      setServerError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onCancelRun = async () => {
    if (!runId) return;

    try {
      setServerError('');

      await api.patch(`/background-runs/${runId}/cancel`);

      setRunStatus('cancelled');
      setIsBackgroundRunning(false);
      setIsSubmitting(false);
      setServerError('SEO keyword opportunity task was cancelled.');
      toast.error('SEO keyword opportunity task was cancelled.');

      setRunId('');
    } catch (error: any) {
      const message = getErrorMessage(
        error,
        'Failed to stop SEO keyword opportunity task.'
      );

      setServerError(message);
      toast.error(message);
    }
  };

  const isBusy = isSubmitting || isBackgroundRunning;

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
                  View the latest saved keyword opportunity report first, then generate and save a new one in the background.
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
                    Latest generated: {formatDate(latestDoc.createdAt)}
                  </p>
                )}

                {latestDoc?.telegram && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Telegram:{' '}
                    {latestDoc.telegram.published
                      ? `Published${
                          latestDoc.telegram.publishedAt
                            ? ` at ${formatDate(latestDoc.telegram.publishedAt)}`
                            : ''
                        }`
                      : latestDoc.telegram.error
                        ? `Failed: ${latestDoc.telegram.error}`
                        : 'Not published'}
                  </p>
                )}

                {isBackgroundRunning && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm" />
                      <span>
                        Keyword opportunity report is running in background.
                        Status: <strong>{runStatusLabel}</strong>
                      </span>
                    </div>

                    {runId && (
                      <div className="mt-2 break-all font-mono text-xs opacity-80">
                        Run ID: {runId}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {isBackgroundRunning && (
                  <Button type="button" onClick={onCancelRun}>
                    Stop Task
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={onRunCrew}
                  isLoading={isBusy}
                  disabled={isBusy}
                >
                  {isBackgroundRunning
                    ? 'Running in Background...'
                    : 'Create Keyword Report'}
                </Button>
              </div>
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