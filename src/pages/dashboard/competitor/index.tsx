import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

type CompetitorAnalysisDoc = {
  _id: string;
  title: string;
  appName: string;
  appUrl: string;
  html: string;
  status: 'success' | 'failed';
  generatedAt: string;
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
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString();
}

const CompetitorAnalysisPage = () => {
  const [serverError, setServerError] = useState('');
  const [html, setHtml] = useState('');
  const [latestDoc, setLatestDoc] = useState<CompetitorAnalysisDoc | null>(
    null
  );

  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus | ''>('');
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);

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

      const response = await api.get('/competitor-analysis/latest');
      const doc = response?.data?.data || null;

      setLatestDoc(doc);

      if (doc?.html) {
        setHtml(doc.html);
      } else {
        setHtml('');
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        getErrorMessage(error, 'Failed to fetch latest competitor analysis.')
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

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);
          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          setServerError(
            run?.error?.message || 'Competitor analysis background task failed.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'cancelled') {
          clearInterval(timer);
          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          setServerError(
            run?.error?.message || 'Competitor analysis task was cancelled.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);
        setIsBackgroundRunning(false);
        setIsSubmitting(false);

        setServerError(
          getErrorMessage(
            error,
            'Competitor analysis completed, but the result could not be loaded.'
          )
        );

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

      const response = await api.get('/competitor-analysis/run');
      const responseData = response?.data?.data;

      const nextRunId = responseData?.runId;
      const nextStatus = responseData?.status || 'queued';

      if (nextRunId) {
        setRunId(nextRunId);
        setRunStatus(nextStatus);
        setIsBackgroundRunning(true);
        return;
      }

      // Backward compatibility if backend still returns a completed document.
      const doc = responseData || null;

      setLatestDoc(doc);

      if (doc?.html) {
        setHtml(doc.html);
      } else {
        setHtml('');
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        getErrorMessage(error, 'Failed to start competitor analysis crew.')
      );
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
      setServerError('Competitor analysis task was cancelled.');

      setRunId('');
    } catch (error: any) {
      setServerError(
        getErrorMessage(error, 'Failed to stop competitor analysis task.')
      );
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
                  Competitor Analysis
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  View the latest saved analysis first, then generate and save a
                  new one in the background.
                </p>

                {latestDoc?.generatedAt && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Latest generated: {formatDate(latestDoc.generatedAt)}
                  </p>
                )}

                {latestDoc?.telegram && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Telegram:{' '}
                    {latestDoc.telegram.published
                      ? `Published${
                          latestDoc.telegram.publishedAt
                            ? ` at ${formatDate(
                                latestDoc.telegram.publishedAt
                              )}`
                            : ''
                        }`
                      : latestDoc.telegram.error
                        ? `Failed: ${latestDoc.telegram.error}`
                        : 'Not published'}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
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
                    : 'Run New Analysis'}
                </Button>
              </div>
            </div>

            {isBackgroundRunning && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />
                  <span>
                    Competitor analysis is running in background. Status:{' '}
                    <strong>{runStatusLabel}</strong>
                  </span>
                </div>

                {runId && (
                  <div className="mt-2 break-all font-mono text-xs opacity-80">
                    Run ID: {runId}
                  </div>
                )}
              </div>
            )}

            {serverError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {serverError}
              </div>
            )}
          </div>

          {isLoadingLatest && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800" />
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
                No saved analysis yet
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Run the crew once and the latest generated report will be stored
                in MongoDB.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default CompetitorAnalysisPage;