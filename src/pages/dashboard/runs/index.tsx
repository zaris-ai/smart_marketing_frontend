import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/config/api';
import { withAuth } from '@/utils/withAuth';
import { useSession } from 'next-auth/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

type CrewRun = {
  _id?: string;
  id?: string;
  crewName: string;
  title?: string;
  status: RunStatus;
  payload?: any;
  result?: any;
  error?: {
    message?: string;
    stack?: string;
  };
  savedRecord?: {
    model?: string | null;
    id?: string | null;
  } | null;
  jobId?: string | null;
  cancelRequestedAt?: string | null;
  deletedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  total: number;
  pages: number;
};

const STATUS_OPTIONS: { label: string; value: '' | RunStatus }[] = [
  { label: 'All statuses', value: '' },
  { label: 'Queued', value: 'queued' },
  { label: 'Running', value: 'running' },
  { label: 'Success', value: 'success' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const CREW_OPTIONS = [
  '',
  'blog',
  'blog_from_links',
  'competitor_analysis',
  'dashboard',
  'instagram',
  'instagram_post',
  'manage_competitor_analysis',
  'marketing_email_reply',
  'problem_discovery',
  'research',
  'seo_audit',
  'seo_keyword_opportunity',
  'shopify_trends',
  'store_crm_analysis',
  'store_outreach',
];

function getRunId(run: CrewRun) {
  return run._id || run.id || '';
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function getStatusBadgeClass(status: RunStatus) {
  switch (status) {
    case 'queued':
      return 'badge badge-warning';
    case 'running':
      return 'badge badge-info';
    case 'success':
      return 'badge badge-success';
    case 'failed':
      return 'badge badge-error';
    case 'cancelled':
      return 'badge badge-neutral';
    default:
      return 'badge';
  }
}

function stringifySafe(value: any) {
  if (value === null || value === undefined) return '-';

  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizePaginationMeta(
  rawMeta: any,
  fallbackPage: number,
  fallbackItemsLength: number
): PaginationMeta {
  const page = Number(rawMeta?.page || fallbackPage);
  const limit = Number(rawMeta?.limit || 20);
  const total = Number(rawMeta?.total || fallbackItemsLength);
  const pages = Number(rawMeta?.pages || rawMeta?.totalPages || 1);

  return {
    page,
    limit,
    total,
    pages: Math.max(pages, 1),
  };
}

function isStoppable(status: RunStatus) {
  return status === 'queued' || status === 'running';
}

function BackgroundRunsPage() {
  const { data: session } = useSession();

  const [runs, setRuns] = useState<CrewRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<CrewRun | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState('');

  const [statusFilter, setStatusFilter] = useState<'' | RunStatus>('');
  const [crewFilter, setCrewFilter] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<PaginationMeta>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [actionRunId, setActionRunId] = useState('');

  const authHeaders = useMemo(() => {
    return session?.accessToken
      ? {
          Authorization: `Bearer ${session.accessToken}`,
        }
      : {};
  }, [session?.accessToken]);

  const activeRunsCount = useMemo(() => {
    return runs.filter((run) => run.status === 'queued' || run.status === 'running')
      .length;
  }, [runs]);

  const runningRunsCount = useMemo(() => {
    return runs.filter((run) => run.status === 'running').length;
  }, [runs]);

  const failedRunsCount = useMemo(() => {
    return runs.filter((run) => run.status === 'failed').length;
  }, [runs]);

  const successRunsCount = useMemo(() => {
    return runs.filter((run) => run.status === 'success').length;
  }, [runs]);

  const cancelledRunsCount = useMemo(() => {
    return runs.filter((run) => run.status === 'cancelled').length;
  }, [runs]);

  const fetchRuns = async (options?: { silent?: boolean; targetPage?: number }) => {
    const silent = options?.silent || false;
    const targetPage = options?.targetPage || page;

    try {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setListError('');

      const response = await api.get('/background-runs', {
        headers: authHeaders,
        params: {
          page: targetPage,
          limit: 20,
          status: statusFilter || undefined,
          crewName: crewFilter || undefined,
        },
      });

      const responseData = response.data?.data;

      const items =
        responseData?.items ||
        responseData?.runs ||
        responseData?.data ||
        response.data?.items ||
        response.data?.runs ||
        [];

      const rawMeta =
        responseData?.pagination ||
        responseData?.meta ||
        response.data?.pagination ||
        response.data?.meta ||
        {};

      setRuns(Array.isArray(items) ? items : []);
      setMeta(
        normalizePaginationMeta(
          rawMeta,
          targetPage,
          Array.isArray(items) ? items.length : 0
        )
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Failed to load background runs.';

      setListError(message);
      setRuns([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchRuns({ targetPage: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, statusFilter, crewFilter]);

  useEffect(() => {
    if (!session?.accessToken || !autoRefresh) return;

    const timer = setInterval(() => {
      fetchRuns({ silent: true });
    }, 4000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.accessToken, autoRefresh, page, statusFilter, crewFilter]);

  const handleRefresh = async () => {
    await fetchRuns({ silent: true });
  };

  const openDetailModal = (run: CrewRun) => {
    setSelectedRun(run);
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRun(null);
  };

  const handlePreviousPage = async () => {
    if (page <= 1) return;

    const nextPage = page - 1;
    setPage(nextPage);
    await fetchRuns({ targetPage: nextPage });
  };

  const handleNextPage = async () => {
    if (page >= meta.pages) return;

    const nextPage = page + 1;
    setPage(nextPage);
    await fetchRuns({ targetPage: nextPage });
  };

  const resetFilters = () => {
    setStatusFilter('');
    setCrewFilter('');
    setPage(1);
  };

  const handleStopRun = async (run: CrewRun) => {
    const runId = getRunId(run);

    if (!runId) {
      toast.error('Run ID is missing.');
      return;
    }

    if (!isStoppable(run.status)) {
      toast.error('Only queued or running tasks can be stopped.');
      return;
    }

    try {
      setActionRunId(runId);

      const response = await api.patch(
        `/background-runs/${runId}/cancel`,
        {},
        {
          headers: authHeaders,
        }
      );

      toast.success(response?.data?.message || 'Background task stopped.');

      await fetchRuns({ silent: true });

      if (selectedRun && getRunId(selectedRun) === runId) {
        const nextRun = response?.data?.data || null;
        setSelectedRun(nextRun);
      }
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to stop background task.'
      );
    } finally {
      setActionRunId('');
    }
  };

  const handleDeleteRun = async (run: CrewRun) => {
    const runId = getRunId(run);

    if (!runId) {
      toast.error('Run ID is missing.');
      return;
    }

    const confirmed = window.confirm(
      `Delete this background run?\n\n${run.title || run.crewName}`
    );

    if (!confirmed) return;

    try {
      setActionRunId(runId);

      const response = await api.delete(`/background-runs/${runId}`, {
        headers: authHeaders,
      });

      toast.success(response?.data?.message || 'Background run deleted.');

      if (selectedRun && getRunId(selectedRun) === runId) {
        closeDetailModal();
      }

      await fetchRuns({ silent: true });
    } catch (error: any) {
      toast.error(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'Failed to delete background run.'
      );
    } finally {
      setActionRunId('');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Background Runs</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Track, stop, delete, and inspect CrewAI background tasks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="label cursor-pointer gap-2 rounded-xl border border-base-300 px-3 py-2">
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span className="label-text">Auto refresh</span>
            </label>

            <Button onClick={handleRefresh} disabled={isRefreshing}>
              {isRefreshing ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Refreshing...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-sm text-base-content/60">Active</p>
            <p className="mt-2 text-3xl font-bold">{activeRunsCount}</p>
            <p className="mt-1 text-xs text-base-content/50">Queued or running</p>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-sm text-base-content/60">Running</p>
            <p className="mt-2 text-3xl font-bold">{runningRunsCount}</p>
            <p className="mt-1 text-xs text-base-content/50">Currently executing</p>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-sm text-base-content/60">Success</p>
            <p className="mt-2 text-3xl font-bold">{successRunsCount}</p>
            <p className="mt-1 text-xs text-base-content/50">Loaded page only</p>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-sm text-base-content/60">Failed</p>
            <p className="mt-2 text-3xl font-bold">{failedRunsCount}</p>
            <p className="mt-1 text-xs text-base-content/50">Needs review</p>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <p className="text-sm text-base-content/60">Cancelled</p>
            <p className="mt-2 text-3xl font-bold">{cancelledRunsCount}</p>
            <p className="mt-1 text-xs text-base-content/50">Stopped by user</p>
          </div>
        </div>

        <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-4">
            <label className="form-control w-full">
              <div className="label">
                <span className="label-text">Status</span>
              </div>
              <select
                className="select select-bordered w-full"
                value={statusFilter}
                onChange={(e) => {
                  setPage(1);
                  setStatusFilter(e.target.value as '' | RunStatus);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control w-full md:col-span-2">
              <div className="label">
                <span className="label-text">Crew</span>
              </div>
              <select
                className="select select-bordered w-full"
                value={crewFilter}
                onChange={(e) => {
                  setPage(1);
                  setCrewFilter(e.target.value);
                }}
              >
                {CREW_OPTIONS.map((crew) => (
                  <option key={crew || 'all'} value={crew}>
                    {crew || 'All crews'}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <button className="btn btn-outline w-full" onClick={resetFilters}>
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {listError ? (
          <div className="alert alert-error">
            <span>{listError}</span>
          </div>
        ) : null}

        <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="flex flex-col gap-2 border-b border-base-300 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Runs</h2>
              <p className="text-sm text-base-content/60">
                Total: {meta.total} · Page {meta.page} of {meta.pages}
              </p>
            </div>

            {isRefreshing ? (
              <div className="flex items-center gap-2 text-sm text-base-content/60">
                <span className="loading loading-spinner loading-sm" />
                Updating...
              </div>
            ) : null}
          </div>

          {isLoading ? (
            <div className="p-6">
              <div className="space-y-3">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </div>
          ) : runs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base-content/70">No background runs found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Title</th>
                    <th>Crew</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Started</th>
                    <th>Finished</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {runs.map((run, index) => {
                    const runId = getRunId(run);
                    const isActionLoading = actionRunId === runId;

                    return (
                      <tr key={runId || `${run.crewName}-${index}`}>
                        <td>{(meta.page - 1) * meta.limit + index + 1}</td>

                        <td>
                          <div className="max-w-[260px]">
                            <p className="truncate font-medium">
                              {run.title || 'Untitled run'}
                            </p>
                            <p className="truncate text-xs text-base-content/50">
                              {runId}
                            </p>
                          </div>
                        </td>

                        <td>
                          <span className="font-mono text-xs">{run.crewName}</span>
                        </td>

                        <td>
                          <span className={getStatusBadgeClass(run.status)}>
                            {run.status}
                          </span>
                        </td>

                        <td>{formatDate(run.createdAt)}</td>
                        <td>{formatDate(run.startedAt)}</td>
                        <td>{formatDate(run.finishedAt)}</td>

                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn btn-sm btn-outline btn-info"
                              onClick={() => openDetailModal(run)}
                              disabled={isActionLoading}
                            >
                              View
                            </button>

                            {isStoppable(run.status) && (
                              <button
                                className="btn btn-sm btn-outline btn-warning"
                                onClick={() => handleStopRun(run)}
                                disabled={isActionLoading}
                              >
                                {isActionLoading ? 'Stopping...' : 'Stop'}
                              </button>
                            )}

                            <button
                              className="btn btn-sm btn-outline btn-error"
                              onClick={() => handleDeleteRun(run)}
                              disabled={isActionLoading}
                            >
                              {isActionLoading ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-base-300 px-5 py-4 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-base-content/60">
              Showing {runs.length} of {meta.total}
            </p>

            <div className="join">
              <button
                className="btn join-item btn-sm"
                onClick={handlePreviousPage}
                disabled={page <= 1 || isLoading || isRefreshing}
              >
                Previous
              </button>

              <button className="btn join-item btn-sm" disabled>
                Page {meta.page}
              </button>

              <button
                className="btn join-item btn-sm"
                onClick={handleNextPage}
                disabled={page >= meta.pages || isLoading || isRefreshing}
              >
                Next
              </button>
            </div>
          </div>
        </div>

        <div className={`modal ${isDetailModalOpen ? 'modal-open' : ''}`} role="dialog">
          <div className="modal-box max-w-5xl rounded-2xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-bold">
                  {selectedRun?.title || 'Run Details'}
                </h3>
                <p className="mt-1 text-sm text-base-content/70">
                  {selectedRun?.crewName ? (
                    <>
                      Crew:{' '}
                      <span className="font-mono">{selectedRun.crewName}</span>
                    </>
                  ) : null}
                </p>
              </div>

              {selectedRun?.status ? (
                <span className={getStatusBadgeClass(selectedRun.status)}>
                  {selectedRun.status}
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Run ID</p>
                <p className="mt-1 break-all font-mono text-xs text-base-content/70">
                  {selectedRun ? getRunId(selectedRun) : '-'}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">BullMQ Job ID</p>
                <p className="mt-1 break-all font-mono text-xs text-base-content/70">
                  {selectedRun?.jobId || '-'}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Created</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {formatDate(selectedRun?.createdAt)}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Updated</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {formatDate(selectedRun?.updatedAt)}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Started</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {formatDate(selectedRun?.startedAt)}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Finished</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {formatDate(selectedRun?.finishedAt)}
                </p>
              </div>

              <div className="rounded-xl border border-base-300 p-4">
                <p className="text-sm font-semibold">Cancel Requested</p>
                <p className="mt-1 text-sm text-base-content/70">
                  {formatDate(selectedRun?.cancelRequestedAt)}
                </p>
              </div>
            </div>

            {selectedRun?.savedRecord ? (
              <div className="mt-4 rounded-xl border border-success/30 bg-success/5 p-4">
                <p className="text-sm font-semibold">Saved Record</p>
                <p className="mt-1 break-all text-sm text-base-content/70">
                  Model: {selectedRun.savedRecord.model || '-'} · ID:{' '}
                  {selectedRun.savedRecord.id || '-'}
                </p>
              </div>
            ) : null}

            {selectedRun?.error?.message ? (
              <div className="alert alert-error mt-4">
                <span>{selectedRun.error.message}</span>
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div>
                <h4 className="mb-2 font-semibold">Payload</h4>
                <pre className="max-h-[420px] overflow-auto rounded-xl bg-base-200 p-4 text-xs">
                  {stringifySafe(selectedRun?.payload)}
                </pre>
              </div>

              <div>
                <h4 className="mb-2 font-semibold">Result</h4>
                <pre className="max-h-[420px] overflow-auto rounded-xl bg-base-200 p-4 text-xs">
                  {stringifySafe(selectedRun?.result)}
                </pre>
              </div>
            </div>

            {selectedRun?.error?.stack ? (
              <div className="mt-6">
                <h4 className="mb-2 font-semibold">Error Stack</h4>
                <pre className="max-h-[320px] overflow-auto rounded-xl bg-base-200 p-4 text-xs">
                  {selectedRun.error.stack}
                </pre>
              </div>
            ) : null}

            <div className="modal-action">
              {selectedRun && isStoppable(selectedRun.status) && (
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={() => handleStopRun(selectedRun)}
                  disabled={actionRunId === getRunId(selectedRun)}
                >
                  {actionRunId === getRunId(selectedRun)
                    ? 'Stopping...'
                    : 'Stop Task'}
                </button>
              )}

              {selectedRun && (
                <button
                  type="button"
                  className="btn btn-error"
                  onClick={() => handleDeleteRun(selectedRun)}
                  disabled={actionRunId === getRunId(selectedRun)}
                >
                  {actionRunId === getRunId(selectedRun)
                    ? 'Deleting...'
                    : 'Delete'}
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDetailModal}
              >
                Close
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Refreshing...
                  </>
                ) : (
                  'Refresh Runs'
                )}
              </button>
            </div>
          </div>

          <div className="modal-backdrop" onClick={closeDetailModal}>
            <button type="button">close</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();

export default BackgroundRunsPage;