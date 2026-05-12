import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

type StoreOutreachFormData = {
  website_url: string;
  store_name: string;
  manager_name: string;
  tone: string;
  email_goal: string;
  notes: string;
  force_refresh: boolean;
};

type SelectedStore = {
  _id: string;
  name: string;
  domain: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  isActive: boolean;
};

type StoreOutreachResult = {
  _id?: string;
  title?: string;
  websiteUrl?: string;
  normalizedWebsiteUrl?: string;
  storeName?: string;
  managerName?: string;
  crewName?: string;
  analysis?: {
    title?: string;
    store?: {
      name?: string;
      website_url?: string;
      summary?: string;
      observed_signals?: string[];
      blind_spots?: string[];
    };
    app_fit?: {
      overall_fit?: 'high' | 'medium' | 'low' | string;
      fit_score?: number;
      reasons?: string[];
      use_cases?: string[];
      pitch_angles?: string[];
      risks?: string[];
      confidence_notes?: string;
    };
    email?: {
      subject?: string;
      preview_line?: string;
      body?: string;
    };
    sources?: string[];
  };
  email?: {
    subject?: string;
    previewLine?: string;
    preview_line?: string;
    body?: string;
  };
  rawResult?: any;
  status?: 'success' | 'failed';
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
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
  status: 'queued' | 'running' | 'success' | 'failed';
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

const defaultFormValues: StoreOutreachFormData = {
  website_url: '',
  store_name: '',
  manager_name: '',
  tone: 'direct and strategic',
  email_goal: 'book a short intro call',
  notes: '',
  force_refresh: false,
};

function extractJsonBlock(value: any) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end <= start) return null;

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function buildResultFromRun(run: BackgroundRun): StoreOutreachResult | null {
  const rawContent =
    run?.result?.result?.content ||
    run?.result?.content ||
    run?.result?.rawContent ||
    '';

  const parsed = extractJsonBlock(rawContent);

  if (!parsed) return null;

  return {
    title: parsed?.title || 'Store Outreach Analysis',
    storeName: parsed?.store?.name || parsed?.store_name || '',
    websiteUrl: parsed?.store?.website_url || '',
    crewName: 'store_outreach',
    analysis: parsed,
    email: {
      subject: parsed?.email?.subject || '',
      previewLine: parsed?.email?.preview_line || '',
      preview_line: parsed?.email?.preview_line || '',
      body: parsed?.email?.body || '',
    },
    rawResult: run.result,
    status: 'success',
    generatedAt: run.finishedAt || new Date().toISOString(),
  };
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function renderList(items?: string[]) {
  if (!items?.length) return null;

  return (
    <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 dark:text-gray-300">
      {items.map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  );
}

const StoreOutreachPage = () => {
  const router = useRouter();
  const { storeId } = router.query;

  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState<StoreOutreachResult | null>(null);
  const [isCached, setIsCached] = useState(false);

  const [selectedStore, setSelectedStore] = useState<SelectedStore | null>(null);
  const [isStoreLoading, setIsStoreLoading] = useState(true);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState('');
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StoreOutreachFormData>({
    defaultValues: defaultFormValues,
  });

  const analysis = result?.analysis;
  const analyzedStore = analysis?.store;
  const appFit = analysis?.app_fit;
  const email = analysis?.email || result?.email;

  const isBusy = isSubmitting || isBackgroundRunning;

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

  useEffect(() => {
    if (!router.isReady) return;

    if (!storeId || typeof storeId !== 'string') {
      setIsStoreLoading(false);
      return;
    }

    const fetchStore = async () => {
      try {
        setIsStoreLoading(true);

        const response = await api.get(`/stores/${storeId}`);
        const store = response?.data?.data?.store || response?.data?.data;

        if (!store) {
          toast.error('Store not found.');
          setIsStoreLoading(false);
          return;
        }

        setSelectedStore(store);

        setValue('website_url', store.domain || '');
        setValue('store_name', store.name || '');
        setValue('manager_name', store.contactName || '');
        setValue('notes', store.notes || '');
      } catch (error: any) {
        const message =
          error?.response?.data?.error ||
          error?.response?.data?.message ||
          error?.response?.data?.detail ||
          'Failed to load store information.';

        toast.error(message);
      } finally {
        setIsStoreLoading(false);
      }
    };

    fetchStore();
  }, [router.isReady, storeId, setValue]);

  const fetchLatestOutreach = async () => {
    const response = await api.get('/store-outreach/latest');
    return response?.data?.data || null;
  };

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${runId}`);
        const run: BackgroundRun | undefined = response?.data?.data;

        if (!run) return;

        setRunStatus(run.status || '');

        if (run.status === 'success') {
          clearInterval(timer);
          setIsBackgroundRunning(false);

          let savedResult: StoreOutreachResult | null = null;

          try {
            savedResult = await fetchLatestOutreach();
          } catch {
            savedResult = buildResultFromRun(run);
          }

          if (!savedResult) {
            savedResult = buildResultFromRun(run);
          }

          if (savedResult) {
            setResult(savedResult);
            setIsCached(false);
            toast.success('Store outreach analysis completed.');
          } else {
            toast.error(
              'Store outreach completed, but the result could not be loaded.'
            );
          }

          setRunId('');
          setRunStatus('');
        }

        if (run.status === 'failed') {
          clearInterval(timer);
          setIsBackgroundRunning(false);

          const message =
            run?.error?.message || 'Store outreach background task failed.';

          setServerError(message);
          toast.error(message);

          setRunId('');
          setRunStatus('');
        }
      } catch {
        // Keep polling silently. Avoid noisy repeated errors.
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [runId]);

  const onSubmit = async (data: StoreOutreachFormData) => {
    try {
      setServerError('');
      setResult(null);
      setIsCached(false);
      setRunId('');
      setRunStatus('');
      setIsBackgroundRunning(false);

      const response = await api.post('/store-outreach', {
        website_url: data.website_url,
        store_name: data.store_name,
        manager_name: data.manager_name,
        tone: data.tone,
        email_goal: data.email_goal,
        notes: data.notes,
        force_refresh: data.force_refresh,
      });

      const cached = Boolean(response.data.cached);
      const responseData = response.data.data;

      if (cached) {
        setResult(responseData);
        setIsCached(true);
        toast.success('Existing store outreach result loaded from database.');
        return;
      }

      const nextRunId = responseData?.runId;
      const nextStatus = responseData?.status || 'queued';

      if (nextRunId) {
        setRunId(nextRunId);
        setRunStatus(nextStatus);
        setIsBackgroundRunning(true);

        toast.success(
          response?.data?.message ||
            'Store outreach analysis started in background.'
        );
        return;
      }

      setResult(responseData);
      setIsCached(false);
      toast.success('Store outreach completed successfully.');
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to run store outreach crew.';

      setServerError(message);
      toast.error(message);
    }
  };

  const clearSelectedStore = () => {
    setSelectedStore(null);
    setResult(null);
    setIsCached(false);
    setServerError('');
    setRunId('');
    setRunStatus('');
    setIsBackgroundRunning(false);

    reset(defaultFormValues);

    toast.success('Selected store removed from this page.');
  };

  const handleRemoveStoreFromPage = () => {
    if (!selectedStore) return;

    toast.dismiss();

    toast(`Remove "${selectedStore.name}" from this page?`, {
      description:
        'This only clears the selected store locally. Nothing will be deleted from the database.',
      action: {
        label: 'Remove',
        onClick: () => {
          clearSelectedStore();
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Store Outreach Crew Runner
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Analyze a selected store and generate a personalized outreach email.
              </p>
            </div>

            {isStoreLoading ? (
              <div className="flex items-center justify-center py-10">
                <span className="loading loading-spinner loading-md" />
              </div>
            ) : selectedStore ? (
              <div className="mb-8 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Selected Store
                  </h2>

                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                        selectedStore.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {selectedStore.isActive ? 'Active' : 'Inactive'}
                    </span>

                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      onClick={handleRemoveStoreFromPage}
                      disabled={isBusy}
                    >
                      Remove From Page
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 text-sm text-gray-700 dark:text-gray-300 md:grid-cols-2 xl:grid-cols-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Store Name
                    </p>
                    <p className="mt-1">{selectedStore.name || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Domain
                    </p>
                    <p className="mt-1 break-all">
                      {selectedStore.domain || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Country
                    </p>
                    <p className="mt-1">{selectedStore.country || 'N/A'}</p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Contact Name
                    </p>
                    <p className="mt-1">
                      {selectedStore.contactName || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Contact Email
                    </p>
                    <p className="mt-1 break-all">
                      {selectedStore.contactEmail || 'N/A'}
                    </p>
                  </div>

                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Store ID
                    </p>
                    <p className="mt-1 break-all">{selectedStore._id}</p>
                  </div>

                  <div className="md:col-span-2 xl:col-span-3">
                    <p className="font-medium text-gray-900 dark:text-white">
                      Notes
                    </p>
                    <p className="mt-1">{selectedStore.notes || 'N/A'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mb-8 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                No store was selected. Open this page from the Stores list using
                the Outreach button.
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {serverError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {serverError}
                </div>
              )}

              {isBackgroundRunning && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm" />
                    <span>
                      Store outreach is running in background. Status:{' '}
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

              <Input
                {...register('website_url', {
                  required: 'Website URL is required',
                  minLength: {
                    value: 5,
                    message: 'Website URL must be at least 5 characters',
                  },
                })}
                type="text"
                label="Store Website URL"
                placeholder="https://example-store.com"
                error={errors.website_url?.message}
                dir="ltr"
                autoFocus
              />

              <Input
                {...register('store_name')}
                type="text"
                label="Store Name"
                placeholder="Optional"
                error={errors.store_name?.message}
                dir="ltr"
              />

              <Input
                {...register('manager_name')}
                type="text"
                label="Manager Name"
                placeholder="Optional"
                error={errors.manager_name?.message}
                dir="ltr"
              />

              <Input
                {...register('tone', {
                  required: 'Tone is required',
                })}
                type="text"
                label="Tone"
                placeholder="direct and strategic"
                error={errors.tone?.message}
                dir="ltr"
              />

              <Input
                {...register('email_goal', {
                  required: 'Email goal is required',
                })}
                type="text"
                label="Email Goal"
                placeholder="book a short intro call"
                error={errors.email_goal?.message}
                dir="ltr"
              />

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  placeholder="Optional notes for the analysis..."
                  rows={4}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:border-gray-600"
                  dir="ltr"
                />
              </div>

              <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  {...register('force_refresh')}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary dark:border-gray-700"
                  disabled={isBusy}
                />
                Force refresh and ignore cached result
              </label>

              <Button type="submit" isLoading={isBusy} disabled={isBusy}>
                {isBackgroundRunning
                  ? 'Running in Background...'
                  : 'Run Store Outreach Crew'}
              </Button>
            </form>

            {result && (
              <div className="mt-8 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Response
                  </h2>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      isCached
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    }`}
                  >
                    {isCached ? 'Returned from database' : 'Generated result'}
                  </span>

                  {appFit?.overall_fit && (
                    <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Fit: {appFit.overall_fit}
                      {typeof appFit.fit_score === 'number'
                        ? ` (${appFit.fit_score}/100)`
                        : ''}
                    </span>
                  )}

                  {result.generatedAt && (
                    <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      Generated: {formatDate(result.generatedAt)}
                    </span>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Store Overview
                    </h3>
                    <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                      <p>
                        <span className="font-medium">Store name:</span>{' '}
                        {analyzedStore?.name ||
                          result.storeName ||
                          selectedStore?.name ||
                          'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">Website:</span>{' '}
                        {analyzedStore?.website_url ||
                          result.websiteUrl ||
                          selectedStore?.domain ||
                          'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">Manager:</span>{' '}
                        {result.managerName ||
                          selectedStore?.contactName ||
                          'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">Status:</span>{' '}
                        {result.status || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Summary
                    </h3>
                    <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                      {analyzedStore?.summary || 'No summary returned.'}
                    </p>
                  </div>
                </div>

                {analyzedStore?.observed_signals?.length ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Observed Signals
                    </h3>
                    {renderList(analyzedStore.observed_signals)}
                  </div>
                ) : null}

                {analyzedStore?.blind_spots?.length ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Blind Spots
                    </h3>
                    {renderList(analyzedStore.blind_spots)}
                  </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {appFit?.reasons?.length ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Why Arka Fits
                      </h3>
                      {renderList(appFit.reasons)}
                    </div>
                  ) : null}

                  {appFit?.use_cases?.length ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Use Cases
                      </h3>
                      {renderList(appFit.use_cases)}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {appFit?.pitch_angles?.length ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Best Pitch Angles
                      </h3>
                      {renderList(appFit.pitch_angles)}
                    </div>
                  ) : null}

                  {appFit?.risks?.length ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Risks and Unknowns
                      </h3>
                      {renderList(appFit.risks)}
                    </div>
                  ) : null}
                </div>

                {appFit?.confidence_notes ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Confidence Notes
                    </h3>
                    <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                      {appFit.confidence_notes}
                    </p>
                  </div>
                ) : null}

                {email ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                      Generated Marketing Email
                    </h3>

                    <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                      <p>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Subject:
                        </span>{' '}
                        {email.subject || 'N/A'}
                      </p>

                      <p>
                        <span className="font-medium text-gray-900 dark:text-white">
                          Preview line:
                        </span>{' '}
                        {(email as any).preview_line ||
                          (email as any).previewLine ||
                          'N/A'}
                      </p>

                      <div>
                        <p className="mb-2 font-medium text-gray-900 dark:text-white">
                          Body:
                        </p>
                        <pre className="whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm leading-6 text-gray-800 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
                          {email.body || 'N/A'}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : null}

                {analysis?.sources?.length ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Sources
                    </h3>
                    {renderList(analysis.sources)}
                  </div>
                ) : null}

                {result.telegram ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm dark:border-gray-800 dark:bg-gray-950">
                    <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Telegram
                    </h3>

                    <p className="text-gray-700 dark:text-gray-300">
                      Published:{' '}
                      {result.telegram.published ? 'Yes' : 'No'}
                    </p>

                    {result.telegram.publishedAt && (
                      <p className="mt-1 text-gray-700 dark:text-gray-300">
                        Published at: {formatDate(result.telegram.publishedAt)}
                      </p>
                    )}

                    {result.telegram.error && (
                      <p className="mt-1 text-red-600 dark:text-red-400">
                        Error: {result.telegram.error}
                      </p>
                    )}
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                    Raw Response
                  </h3>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default StoreOutreachPage;