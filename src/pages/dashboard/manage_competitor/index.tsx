import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { toast } from 'sonner';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

type ManageCompetitorFormData = {
  name: string;
  description: string;
  status: 'active' | 'inactive';
  links: {
    value: string;
  }[];
};

type ManageCompetitorItem = {
  _id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  links: string[];
};

type ManageCompetitorAnalysisItem = {
  _id: string;
  title: string;
  appName: string;
  appUrl: string;
  analysisGoal: string;
  html: string;
  selectedCompetitorIds: string[];
  selectedCompetitors: {
    competitorId: string;
    name: string;
    description: string;
    status: 'active' | 'inactive';
    links: string[];
  }[];
  createdAt?: string;
  generatedAt?: string;
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

const truncateText = (value: string, maxLength = 120) => {
  if (!value) return '-';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
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
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

const ManageCompetitorsPage = () => {
  const [items, setItems] = useState<ManageCompetitorItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [deletingCompetitorId, setDeletingCompetitorId] = useState<string | null>(
    null
  );

  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>(
    []
  );
  const [analysisGoal, setAnalysisGoal] = useState(
    'Analyze selected competitors and identify strengths, weaknesses, and catch-up priorities.'
  );
  const [maxSelectedCompetitors, setMaxSelectedCompetitors] = useState<number>(0);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus | ''>('');
  const [isRunningAnalysis, setIsRunningAnalysis] = useState(false);

  const [analyses, setAnalyses] = useState<ManageCompetitorAnalysisItem[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [deletingAnalysisId, setDeletingAnalysisId] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] =
    useState<ManageCompetitorAnalysisItem | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAnalysesModalOpen, setIsAnalysesModalOpen] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ManageCompetitorFormData>({
    defaultValues: {
      name: '',
      description: '',
      status: 'active',
      links: [{ value: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'links',
  });

  const linksCount = useMemo(() => fields.length, [fields.length]);
  const selectedCount = selectedCompetitorIds.length;

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';
    if (runStatus === 'cancelled') return 'Cancelled';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

  const fetchCompetitors = async (showToast = false) => {
    try {
      setLoadingList(true);

      const response = await api.get('/manage-competitors');
      setItems(response?.data?.data?.items || []);

      if (showToast) {
        toast.success('Competitors refreshed.');
      }
    } catch (error: any) {
      console.log(error);
      toast.error(
        getErrorMessage(error, 'Failed to fetch competitors.')
      );
    } finally {
      setLoadingList(false);
    }
  };

  const fetchAnalyses = async (preferredId?: string, showToast = false) => {
    try {
      setLoadingAnalyses(true);

      const response = await api.get('/manage-competitor-analyses');
      const fetchedItems = response?.data?.data?.items || [];

      setAnalyses(fetchedItems);

      if (preferredId) {
        const matched =
          fetchedItems.find(
            (item: ManageCompetitorAnalysisItem) => item._id === preferredId
          ) || null;

        setActiveAnalysis(matched || fetchedItems[0] || null);
      } else {
        setActiveAnalysis((current) => {
          if (!current && fetchedItems.length > 0) {
            return fetchedItems[0];
          }

          if (
            current &&
            !fetchedItems.some(
              (item: ManageCompetitorAnalysisItem) => item._id === current._id
            )
          ) {
            return fetchedItems[0] || null;
          }

          return current;
        });
      }

      if (showToast) {
        toast.success('Saved analyses refreshed.');
      }
    } catch (error: any) {
      console.log(error);
      toast.error(
        getErrorMessage(error, 'Failed to fetch analyses.')
      );
    } finally {
      setLoadingAnalyses(false);
    }
  };

  useEffect(() => {
    fetchCompetitors();
    fetchAnalyses();
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
          setIsRunningAnalysis(false);

          const savedId = run.savedRecord?.id || undefined;

          await fetchAnalyses(savedId);

          toast.success('Competitor analysis generated and saved successfully.');

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);
          setIsRunningAnalysis(false);

          toast.error(
            run?.error?.message || 'Competitor analysis background task failed.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'cancelled') {
          clearInterval(timer);
          setIsRunningAnalysis(false);

          toast.error(
            run?.error?.message || 'Competitor analysis task was cancelled.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);
        setIsRunningAnalysis(false);

        toast.error(
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

  const onSubmit = async (data: ManageCompetitorFormData) => {
    const toastId = toast.loading('Saving competitor...');

    try {
      const payload = {
        name: data.name.trim(),
        description: data.description.trim(),
        status: data.status,
        links: data.links.map((item) => item.value.trim()).filter(Boolean),
      };

      const response = await api.post('/manage-competitors', payload);

      reset({
        name: '',
        description: '',
        status: 'active',
        links: [{ value: '' }],
      });

      setIsCreateModalOpen(false);
      await fetchCompetitors();

      toast.success(
        response?.data?.message || 'Competitor created successfully.',
        { id: toastId }
      );
    } catch (error: any) {
      console.log(error);
      toast.error(getErrorMessage(error, 'Failed to create competitor.'), {
        id: toastId,
      });
    }
  };

  const toggleCompetitorSelection = (competitorId: string) => {
    setSelectedCompetitorIds((prev) =>
      prev.includes(competitorId)
        ? prev.filter((id) => id !== competitorId)
        : [...prev, competitorId]
    );
  };

  const deleteCompetitor = async (competitorId: string, competitorName: string) => {
    const confirmed = window.confirm(`Delete competitor "${competitorName}"?`);
    if (!confirmed) return;

    const toastId = toast.loading('Deleting competitor...');

    try {
      setDeletingCompetitorId(competitorId);

      const response = await api.delete(`/manage-competitors/${competitorId}`);

      setSelectedCompetitorIds((prev) =>
        prev.filter((id) => id !== competitorId)
      );

      await fetchCompetitors();

      toast.success(
        response?.data?.message || 'Competitor deleted successfully.',
        { id: toastId }
      );
    } catch (error: any) {
      console.log(error);
      toast.error(getErrorMessage(error, 'Failed to delete competitor.'), {
        id: toastId,
      });
    } finally {
      setDeletingCompetitorId(null);
    }
  };

  const runAnalysis = async () => {
    if (!selectedCompetitorIds.length) {
      toast.error('Select at least one competitor.');
      return;
    }

    try {
      setIsRunningAnalysis(true);
      setRunId('');
      setRunStatus('');

      const response = await api.post('/manage-competitor-analyses', {
        appName: 'Arka: Smart Analyzer',
        appUrl: 'https://apps.shopify.com/arka-smart-analyzer',
        analysisGoal,
        selectedCompetitorIds,
        maxSelectedCompetitors: Number(maxSelectedCompetitors) || 0,
      });

      const responseData = response?.data?.data;
      const nextRunId = responseData?.runId;
      const nextStatus = responseData?.status || 'queued';

      if (nextRunId) {
        setRunId(nextRunId);
        setRunStatus(nextStatus);
        toast.success(
          response?.data?.message || 'Competitor analysis started in background.'
        );
        return;
      }

      const createdAnalysis = responseData || null;

      await fetchAnalyses(createdAnalysis?._id);

      toast.success(
        response?.data?.message ||
          'Competitor analysis generated and saved successfully.'
      );
    } catch (error: any) {
      console.log(error);
      toast.error(getErrorMessage(error, 'Failed to run competitor analysis.'));
      setIsRunningAnalysis(false);
    }
  };

  const stopAnalysis = async () => {
    if (!runId) return;

    try {
      await api.patch(`/background-runs/${runId}/cancel`);

      setIsRunningAnalysis(false);
      setRunStatus('cancelled');
      toast.error('Competitor analysis task was cancelled.');
      setRunId('');
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to stop background task.'));
    }
  };

  const deleteAnalysis = async (analysisId: string, title: string) => {
    const confirmed = window.confirm(`Delete analysis "${title}"?`);
    if (!confirmed) return;

    const toastId = toast.loading('Deleting analysis...');

    try {
      setDeletingAnalysisId(analysisId);

      const response = await api.delete(
        `/manage-competitor-analyses/${analysisId}`
      );

      const isActive = activeAnalysis?._id === analysisId;
      if (isActive) {
        setActiveAnalysis(null);
      }

      await fetchAnalyses();

      toast.success(
        response?.data?.message || 'Competitor analysis deleted successfully.',
        { id: toastId }
      );
    } catch (error: any) {
      console.log(error);
      toast.error(
        getErrorMessage(error, 'Failed to delete competitor analysis.'),
        { id: toastId }
      );
    } finally {
      setDeletingAnalysisId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold">
                    Competitor Analysis Workspace
                  </h1>
                  <p className="mt-2 text-sm opacity-70">
                    Select competitors, run analysis in the background, and open saved reports.
                  </p>

                  {isRunningAnalysis && (
                    <div className="mt-4 rounded-xl border border-info/30 bg-info/10 p-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="loading loading-spinner loading-sm" />
                        <span>
                          Background analysis is running. Status:{' '}
                          <strong>{runStatusLabel}</strong>
                        </span>
                      </div>

                      {runId && (
                        <div className="mt-2 break-all font-mono text-xs opacity-70">
                          Run ID: {runId}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setIsCreateModalOpen(true)}
                  >
                    Create Competitor
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setIsAnalysesModalOpen(true)}
                  >
                    Saved Analyses
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => fetchCompetitors(true)}
                    disabled={loadingList}
                  >
                    {loadingList ? 'Refreshing...' : 'Refresh Competitors'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="card border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">All Competitors</h2>
                    <p className="mt-2 text-sm opacity-70">
                      Choose the competitors to include in the analysis.
                    </p>
                  </div>

                  <div className="badge badge-primary badge-lg">
                    Selected: {selectedCount}
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-base-300">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th className="w-20">Select</th>
                        <th className="w-16">#</th>
                        <th className="min-w-[180px]">Name</th>
                        <th className="min-w-[280px]">Description</th>
                        <th className="w-32">Status</th>
                        <th className="min-w-[320px]">Links</th>
                        <th className="w-28">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loadingList ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center">
                            Loading competitors...
                          </td>
                        </tr>
                      ) : items.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center">
                            No competitors found.
                          </td>
                        </tr>
                      ) : (
                        items.map((item, index) => (
                          <tr key={item._id}>
                            <td>
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={selectedCompetitorIds.includes(item._id)}
                                onChange={() => toggleCompetitorSelection(item._id)}
                                disabled={isRunningAnalysis}
                              />
                            </td>

                            <td>{index + 1}</td>

                            <td className="align-top">
                              <div className="font-semibold">{item.name}</div>
                            </td>

                            <td className="align-top">
                              <div
                                className="max-w-xs text-sm leading-6"
                                title={item.description || ''}
                              >
                                {truncateText(item.description, 110)}
                              </div>
                            </td>

                            <td className="align-top">
                              <div
                                className={`badge ${
                                  item.status === 'active'
                                    ? 'badge-success'
                                    : 'badge-ghost'
                                }`}
                              >
                                {item.status}
                              </div>
                            </td>

                            <td className="align-top">
                              <div className="space-y-2">
                                {Array.isArray(item.links) && item.links.length > 0 ? (
                                  item.links.map((link, linkIndex) => (
                                    <div key={`${item._id}-${linkIndex}`}>
                                      <a
                                        href={link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="link link-primary break-all text-sm"
                                      >
                                        {link}
                                      </a>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-sm opacity-60">-</span>
                                )}
                              </div>
                            </td>

                            <td className="align-top">
                              <button
                                type="button"
                                className="btn btn-sm btn-error btn-outline"
                                disabled={
                                  deletingCompetitorId === item._id ||
                                  isRunningAnalysis
                                }
                                onClick={() =>
                                  deleteCompetitor(item._id, item.name)
                                }
                              >
                                {deletingCompetitorId === item._id
                                  ? 'Deleting...'
                                  : 'Delete'}
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 text-sm opacity-70">
                  Total: {items.length} competitor{items.length === 1 ? '' : 's'}
                </div>
              </div>
            </div>

            <div className="card h-fit border border-base-300 bg-base-100 shadow-sm">
              <div className="card-body space-y-5">
                <div>
                  <h2 className="text-xl font-semibold">Run Analysis</h2>
                  <p className="mt-2 text-sm opacity-70">
                    Run the crew only on the selected competitors.
                  </p>
                </div>

                <div className="stats stats-vertical border border-base-300 shadow">
                  <div className="stat">
                    <div className="stat-title">Selected Competitors</div>
                    <div className="stat-value text-primary">{selectedCount}</div>
                    <div className="stat-desc">
                      These competitors will be sent to the crew.
                    </div>
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Max Selected Competitors</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={maxSelectedCompetitors}
                    onChange={(e) =>
                      setMaxSelectedCompetitors(Number(e.target.value) || 0)
                    }
                    className="input input-bordered w-full"
                    disabled={isRunningAnalysis}
                  />
                  <p className="mt-2 text-sm opacity-70">
                    Use 0 to keep all selected competitors.
                  </p>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Analysis Goal</span>
                  </label>
                  <textarea
                    value={analysisGoal}
                    onChange={(e) => setAnalysisGoal(e.target.value)}
                    rows={5}
                    className="textarea textarea-bordered w-full"
                    placeholder="Analyze selected competitors and identify strengths, weaknesses, and catch-up priorities."
                    disabled={isRunningAnalysis}
                  />
                </div>

                {isRunningAnalysis ? (
                  <button
                    type="button"
                    className="btn btn-warning w-full"
                    onClick={stopAnalysis}
                  >
                    Stop Background Task
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={runAnalysis}
                  >
                    Run Analysis
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card border border-base-300 bg-base-100 shadow-sm">
            <div className="card-body">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Analysis Result</h2>
                  <p className="mt-2 text-sm opacity-70">
                    Current saved HTML result rendered directly from the database.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setIsAnalysesModalOpen(true)}
                >
                  Open Saved Analyses
                </button>
              </div>

              {!activeAnalysis ? (
                <div className="rounded-2xl border border-dashed border-base-300 p-8 text-sm opacity-70">
                  No analysis selected yet. Run a new analysis or open one from
                  saved analyses.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-base-300 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="font-semibold">{activeAnalysis.title}</div>
                        <div className="mt-2 text-sm opacity-70">
                          {activeAnalysis.analysisGoal || '-'}
                        </div>
                        <div className="mt-2 text-xs opacity-60">
                          Created: {formatDate(activeAnalysis.createdAt)}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeAnalysis.selectedCompetitors?.map((item) => (
                            <span
                              key={item.competitorId}
                              className="badge badge-outline"
                            >
                              {item.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-sm btn-error btn-outline"
                        disabled={deletingAnalysisId === activeAnalysis._id}
                        onClick={() =>
                          deleteAnalysis(activeAnalysis._id, activeAnalysis.title)
                        }
                      >
                        {deletingAnalysisId === activeAnalysis._id
                          ? 'Deleting...'
                          : 'Delete Result'}
                      </button>
                    </div>
                  </div>

                  <div
                    className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
                    dangerouslySetInnerHTML={{ __html: activeAnalysis.html }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {isCreateModalOpen ? (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Create Competitor</h3>
                  <p className="mt-1 text-sm opacity-70">
                    Add a new competitor to your saved list.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <Input
                    {...register('name', {
                      required: 'Name is required',
                      minLength: {
                        value: 2,
                        message: 'Name must be at least 2 characters',
                      },
                    })}
                    type="text"
                    label="Competitor Name"
                    placeholder="Example Competitor"
                    error={errors.name?.message}
                    dir="ltr"
                    autoFocus
                  />

                  <div>
                    <label className="label">
                      <span className="label-text">Status</span>
                    </label>
                    <select
                      {...register('status', {
                        required: 'Status is required',
                      })}
                      className="select select-bordered w-full"
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                    </select>
                    {errors.status?.message ? (
                      <p className="mt-1 text-sm text-error">
                        {errors.status.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <label className="label">
                    <span className="label-text">Description</span>
                  </label>
                  <textarea
                    {...register('description')}
                    placeholder="Short description about this competitor"
                    rows={4}
                    className="textarea textarea-bordered w-full"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h4 className="font-medium">Competitor Links</h4>
                      <p className="text-sm opacity-70">
                        Add one or more URLs for this competitor.
                      </p>
                    </div>

                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => append({ value: '' })}
                    >
                      Add Link
                    </button>
                  </div>

                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid gap-3 md:grid-cols-[1fr_auto]"
                    >
                      <Input
                        {...register(`links.${index}.value`, {
                          required: 'Link is required',
                          pattern: {
                            value: /^https?:\/\/.+/i,
                            message: 'Link must start with http:// or https://',
                          },
                        })}
                        type="text"
                        label={`Link ${index + 1}`}
                        placeholder="https://example.com"
                        error={errors.links?.[index]?.value?.message}
                        dir="ltr"
                      />

                      <div className="flex items-end">
                        <button
                          type="button"
                          className="btn btn-outline btn-error w-full md:w-auto"
                          onClick={() => remove(index)}
                          disabled={linksCount === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="modal-action mt-6">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </button>

                  <Button type="submit" isLoading={isSubmitting}>
                    Save Competitor
                  </Button>
                </div>
              </form>
            </div>

            <form method="dialog" className="modal-backdrop">
              <button onClick={() => setIsCreateModalOpen(false)}>close</button>
            </form>
          </dialog>
        ) : null}

        {isAnalysesModalOpen ? (
          <dialog className="modal modal-open">
            <div className="modal-box max-w-3xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold">Saved Analyses</h3>
                  <p className="mt-1 text-sm opacity-70">
                    Select one analysis to load it into the main viewer.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fetchAnalyses(undefined, true)}
                    disabled={loadingAnalyses}
                  >
                    {loadingAnalyses ? 'Refreshing...' : 'Refresh'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setIsAnalysesModalOpen(false)}
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
                {loadingAnalyses ? (
                  <div className="text-sm opacity-70">Loading analyses...</div>
                ) : analyses.length === 0 ? (
                  <div className="text-sm opacity-70">No analyses found.</div>
                ) : (
                  analyses.map((item) => (
                    <div
                      key={item._id}
                      className={`rounded-2xl border p-4 transition ${
                        activeAnalysis?._id === item._id
                          ? 'border-primary bg-primary/5'
                          : 'border-base-300'
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveAnalysis(item);
                            setIsAnalysesModalOpen(false);
                            toast.success('Analysis loaded.');
                          }}
                          className="flex-1 text-left"
                        >
                          <div className="font-semibold">{item.title}</div>
                          <div className="mt-2 text-sm opacity-70">
                            {item.selectedCompetitors?.length || 0} competitor
                            {(item.selectedCompetitors?.length || 0) === 1
                              ? ''
                              : 's'}
                          </div>
                          <div className="mt-2 text-xs opacity-60">
                            {item.createdAt
                              ? new Date(item.createdAt).toLocaleString()
                              : ''}
                          </div>
                          <div className="mt-2 text-sm opacity-70">
                            {truncateText(item.analysisGoal || '-', 140)}
                          </div>
                        </button>

                        <button
                          type="button"
                          className="btn btn-sm btn-error btn-outline"
                          disabled={deletingAnalysisId === item._id}
                          onClick={() => deleteAnalysis(item._id, item.title)}
                        >
                          {deletingAnalysisId === item._id
                            ? 'Deleting...'
                            : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <form method="dialog" className="modal-backdrop">
              <button onClick={() => setIsAnalysesModalOpen(false)}>close</button>
            </form>
          </dialog>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default ManageCompetitorsPage;