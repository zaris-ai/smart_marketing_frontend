import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';

type RunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'canceled';

type BackgroundRun = {
  _id: string;
  crewName: string;
  title?: string;
  status: RunStatus;
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

type PostSlide = {
  slide: number;
  visual: string;
  headline: string;
  body_text: string;
  design_direction: string;
};

type InstagramPostIdea = {
  id: string;
  title: string;
  post_type: string;
  angle: string;
  objective: string;
  hook: string;
  slides: PostSlide[];
  creative_prompt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  production_notes: string[];
};

type InstagramPostRun = {
  _id: string;
  runId: string;
  campaign_title: string;
  platform: string;
  format: string;
  strategy_summary: string;
  brand_name: string;
  product_or_service: string;
  app_website_url: string;
  shopify_app_store_url: string;
  target_audience: string;
  campaign_goal: string;
  campaign_name: string;
  brand_voice: string;
  offer: string;
  key_message: string;
  visual_style: string;
  language: string;
  number_of_ideas: number;
  post_format: string;
  notes: string;
  ideas: InstagramPostIdea[];
  markdown?: string;
  createdAt: string;
  updatedAt: string;
};

type InstagramPostForm = {
  target_audience: string;
  campaign_goal: string;
  campaign_name: string;
  brand_voice: string;
  offer: string;
  key_message: string;
  visual_style: string;
  language: string;
  number_of_ideas: number;
  post_format: string;
  notes: string;
};

const APP_CONTEXT = {
  brand_name: 'Arka Smart Analyzer',
  app_website_url: 'https://web.arkaanalyzer.com/',
  shopify_app_store_url: 'https://apps.shopify.com/arka-smart-analyzer',
  product_or_service:
    'Shopify analytics app for product, pricing, inventory, and store performance insights.',
};

const initialForm: InstagramPostForm = {
  target_audience:
    'Shopify store owners who want better business decisions from their store data',
  campaign_goal: 'Generate installs from Shopify merchants',
  campaign_name: 'Find Hidden Store Problems',
  brand_voice: 'direct, expert, practical',
  offer: 'Free install from Shopify App Store',
  key_message: 'Your store data already shows what needs fixing',
  visual_style:
    'clean SaaS dashboard visuals, premium tech style, high-readability feed design',
  language: 'English',
  number_of_ideas: 5,
  post_format: 'carousel',
  notes:
    'Focus on product performance, dead stock, pricing mistakes, inventory problems, and decision-making.',
};

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-950';

const labelClass =
  'mb-2 block text-sm font-medium text-gray-800 dark:text-gray-200';

function formatDate(value?: string) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function getApiError(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    error?.message ||
    fallback
  );
}

function extractBackgroundRun(response: any): BackgroundRun | null {
  const data = response?.data?.data;

  return (
    data?.run ||
    response?.data?.run ||
    (data?._id && data?.status ? data : null)
  );
}

function extractSavedPostRun(response: any): InstagramPostRun | null {
  const data = response?.data?.data;

  if (data?._id && Array.isArray(data?.ideas)) {
    return data;
  }

  if (data?.run?._id && Array.isArray(data?.run?.ideas)) {
    return data.run;
  }

  return null;
}

function isTerminalStatus(status?: RunStatus | string) {
  return (
    status === 'success' ||
    status === 'failed' ||
    status === 'cancelled' ||
    status === 'canceled'
  );
}

const InstagramPostIdeasPage = () => {
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [form, setForm] = useState<InstagramPostForm>(initialForm);
  const [runs, setRuns] = useState<InstagramPostRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<InstagramPostRun | null>(null);
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState(0);

  const [backgroundRun, setBackgroundRun] = useState<BackgroundRun | null>(null);

  const [loadingRuns, setLoadingRuns] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectedIdea = selectedRun?.ideas?.[selectedIdeaIndex] || null;

  const generationStatusLabel = useMemo(() => {
    if (!backgroundRun?._id) return '';

    if (backgroundRun.status === 'queued') return 'Queued';
    if (backgroundRun.status === 'running') return 'Running';
    if (backgroundRun.status === 'success') return 'Completed';
    if (backgroundRun.status === 'failed') return 'Failed';
    if (
      backgroundRun.status === 'cancelled' ||
      backgroundRun.status === 'canceled'
    ) {
      return 'Cancelled';
    }

    return backgroundRun.status;
  }, [backgroundRun]);

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const updateField = <K extends keyof InstagramPostForm>(
    field: K,
    value: InstagramPostForm[K]
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const validateForm = () => {
    if (!form.target_audience.trim()) return 'Target audience is required.';
    if (!form.campaign_goal.trim()) return 'Campaign goal is required.';

    if (form.number_of_ideas < 1 || form.number_of_ideas > 10) {
      return 'Number of ideas must be between 1 and 10.';
    }

    if (!['carousel', 'single_image', 'reel_cover'].includes(form.post_format)) {
      return 'Post format must be carousel, single_image, or reel_cover.';
    }

    return '';
  };

  const loadRuns = async (preferredId?: string) => {
    try {
      setLoadingRuns(true);
      setError('');

      const response = await api.get('/instagram-post-agent/post-ideas', {
        params: {
          page: 1,
          limit: 20,
        },
      });

      const items: InstagramPostRun[] = response?.data?.data?.items || [];

      setRuns(items);

      if (preferredId) {
        const preferred = items.find((item) => item._id === preferredId);

        if (preferred) {
          setSelectedRun(preferred);
          setSelectedIdeaIndex(0);
          return;
        }

        const detailResponse = await api.get(
          `/instagram-post-agent/post-ideas/${preferredId}`
        );

        const detail = extractSavedPostRun(detailResponse);

        if (detail) {
          setRuns((prev) => [
            detail,
            ...prev.filter((item) => item._id !== detail._id),
          ]);
          setSelectedRun(detail);
          setSelectedIdeaIndex(0);
          return;
        }
      }

      if (!selectedRun && items.length > 0) {
        setSelectedRun(items[0]);
        setSelectedIdeaIndex(0);
      }
    } catch (err: any) {
      setError(getApiError(err, 'Failed to load previous Instagram Post runs.'));
    } finally {
      setLoadingRuns(false);
    }
  };

  const loadSavedRunById = async (id: string) => {
    const response = await api.get(`/instagram-post-agent/post-ideas/${id}`);
    const savedRun = extractSavedPostRun(response);

    if (!savedRun?._id || !Array.isArray(savedRun.ideas)) {
      throw new Error('Saved Instagram Post run could not be loaded.');
    }

    setRuns((prev) => [
      savedRun,
      ...prev.filter((item) => item._id !== savedRun._id),
    ]);

    setSelectedRun(savedRun);
    setSelectedIdeaIndex(0);

    return savedRun;
  };

  const pollBackgroundRun = async (runId: string) => {
    const response = await api.get(`/background-runs/${runId}`);
    const latestRun = extractBackgroundRun(response);

    if (!latestRun?._id) {
      throw new Error('Background run not found.');
    }

    setBackgroundRun(latestRun);

    if (!isTerminalStatus(latestRun.status)) {
      return;
    }

    stopPolling();
    setGenerating(false);

    if (latestRun.status === 'failed') {
      const message =
        latestRun.error?.message || 'Instagram Post generation failed.';

      setError(message);
      toast.error(message);
      return;
    }

    if (latestRun.status === 'cancelled' || latestRun.status === 'canceled') {
      const message = 'Instagram Post generation was cancelled.';

      setError(message);
      toast.error(message);
      return;
    }

    const savedId = latestRun.savedRecord?.id || '';

    if (!savedId) {
      const message =
        'Generation finished, but saved document ID was not attached to the background run.';

      setError(message);
      toast.warning(message);
      return;
    }

    await loadSavedRunById(savedId);

    setBackgroundRun(null);
    toast.success('Instagram Post ideas generated and saved.');
  };

  const startPolling = (runId: string) => {
    stopPolling();

    pollTimerRef.current = setInterval(() => {
      pollBackgroundRun(runId).catch((err) => {
        stopPolling();
        setGenerating(false);

        const message = getApiError(
          err,
          'Failed to check Instagram Post generation status.'
        );

        setError(message);
        toast.error(message);
      });
    }, 4000);

    pollBackgroundRun(runId).catch((err) => {
      stopPolling();
      setGenerating(false);

      const message = getApiError(
        err,
        'Failed to check Instagram Post generation status.'
      );

      setError(message);
      toast.error(message);
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    try {
      stopPolling();

      setGenerating(true);
      setError('');
      setBackgroundRun(null);

      const response = await api.post('/instagram-post-agent/post-ideas', form);

      const directSavedRun = extractSavedPostRun(response);

      if (directSavedRun?._id) {
        setRuns((prev) => [
          directSavedRun,
          ...prev.filter((item) => item._id !== directSavedRun._id),
        ]);
        setSelectedRun(directSavedRun);
        setSelectedIdeaIndex(0);
        setGenerating(false);
        toast.success('Instagram Post ideas generated and saved.');
        return;
      }

      const run = extractBackgroundRun(response);

      if (!run?._id) {
        throw new Error('Background run was not created.');
      }

      setBackgroundRun(run);
      toast.success('Instagram Post generation started in background.');

      startPolling(run._id);
    } catch (err: any) {
      stopPolling();
      setGenerating(false);

      const message = getApiError(
        err,
        'Failed to start Instagram Post idea generation.'
      );

      setError(message);
      toast.error(message);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setError('');
  };

  const handleSelectRun = (run: InstagramPostRun) => {
    setSelectedRun(run);
    setSelectedIdeaIndex(0);
  };

  const handleDeleteRun = async () => {
    if (!selectedRun?._id) return;

    const confirmed = window.confirm('Delete this Instagram Post run?');
    if (!confirmed) return;

    try {
      setDeleting(true);
      setError('');

      const deletingId = selectedRun._id;

      await api.delete(`/instagram-post-agent/post-ideas/${deletingId}`);

      setRuns((prev) => {
        const nextRuns = prev.filter((item) => item._id !== deletingId);

        setSelectedRun(nextRuns[0] || null);
        setSelectedIdeaIndex(0);

        return nextRuns;
      });

      toast.success('Instagram Post run deleted.');
    } catch (err: any) {
      const message = getApiError(err, 'Failed to delete Instagram Post run.');

      setError(message);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelRun = async () => {
    if (!backgroundRun?._id) return;

    try {
      await api.patch(`/background-runs/${backgroundRun._id}/cancel`);

      stopPolling();
      setGenerating(false);
      setBackgroundRun(null);

      toast.error('Instagram Post generation cancelled.');
    } catch (err: any) {
      const message = getApiError(
        err,
        'Failed to cancel Instagram Post generation.'
      );

      setError(message);
      toast.error(message);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      toast.success('Copied.');
    } catch {
      setError('Failed to copy text.');
      toast.error('Failed to copy text.');
    }
  };

  useEffect(() => {
    loadRuns();

    return () => {
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Instagram Post Idea Agent
            </h1>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Generate, save, and review Instagram feed post ideas for Arka Smart Analyzer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {runs.length} saved runs
              </p>
            </div>

            <Button
              type="button"
              onClick={() => loadRuns()}
              disabled={loadingRuns || generating}
            >
              {loadingRuns ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {backgroundRun ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">
                  Background generation: {generationStatusLabel}
                </p>

                <p className="mt-1 break-all font-mono text-xs opacity-80">
                  Run ID: {backgroundRun._id}
                </p>
              </div>

              {generating ? (
                <Button type="button" onClick={handleCancelRun}>
                  Stop Task
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
          <div className="space-y-6">
            <form
              onSubmit={handleSubmit}
              className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  New Post Campaign
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Product context is fixed. Each generated result is saved in MongoDB.
                </p>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Fixed App Context
                </p>

                <div className="mt-3 space-y-2 text-sm text-blue-800 dark:text-blue-300">
                  <p>
                    <span className="font-medium">Brand:</span>{' '}
                    {APP_CONTEXT.brand_name}
                  </p>

                  <p>
                    <span className="font-medium">Product:</span>{' '}
                    {APP_CONTEXT.product_or_service}
                  </p>

                  <p>
                    <span className="font-medium">Website:</span>{' '}
                    <a
                      href={APP_CONTEXT.app_website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {APP_CONTEXT.app_website_url}
                    </a>
                  </p>

                  <p>
                    <span className="font-medium">Shopify App Store:</span>{' '}
                    <a
                      href={APP_CONTEXT.shopify_app_store_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {APP_CONTEXT.shopify_app_store_url}
                    </a>
                  </p>
                </div>
              </div>

              <div>
                <label className={labelClass}>Target Audience *</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.target_audience}
                  onChange={(event) =>
                    updateField('target_audience', event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Campaign Goal *</label>
                <input
                  className={inputClass}
                  value={form.campaign_goal}
                  onChange={(event) =>
                    updateField('campaign_goal', event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Post Format</label>
                <select
                  className={inputClass}
                  value={form.post_format}
                  onChange={(event) =>
                    updateField('post_format', event.target.value)
                  }
                >
                  <option value="carousel">Carousel</option>
                  <option value="single_image">Single Image</option>
                  <option value="reel_cover">Reel Cover</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Campaign Name</label>
                <input
                  className={inputClass}
                  value={form.campaign_name}
                  onChange={(event) =>
                    updateField('campaign_name', event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Brand Voice</label>
                <input
                  className={inputClass}
                  value={form.brand_voice}
                  onChange={(event) =>
                    updateField('brand_voice', event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Offer</label>
                <input
                  className={inputClass}
                  value={form.offer}
                  onChange={(event) => updateField('offer', event.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Key Message</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.key_message}
                  onChange={(event) =>
                    updateField('key_message', event.target.value)
                  }
                />
              </div>

              <div>
                <label className={labelClass}>Visual Style</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.visual_style}
                  onChange={(event) =>
                    updateField('visual_style', event.target.value)
                  }
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className={labelClass}>Language</label>
                  <input
                    className={inputClass}
                    value={form.language}
                    onChange={(event) =>
                      updateField('language', event.target.value)
                    }
                  />
                </div>

                <div>
                  <label className={labelClass}>Ideas</label>
                  <input
                    className={inputClass}
                    type="number"
                    min={1}
                    max={10}
                    value={form.number_of_ideas}
                    onChange={(event) =>
                      updateField('number_of_ideas', Number(event.target.value))
                    }
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes</label>
                <textarea
                  className={inputClass}
                  rows={4}
                  value={form.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={generating}>
                  {generating ? 'Generating in Background...' : 'Generate & Save'}
                </Button>

                <Button type="button" onClick={handleReset} disabled={generating}>
                  Reset Form
                </Button>
              </div>
            </form>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Previous Runs
                </h2>

                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  Latest 20
                </span>
              </div>

              {loadingRuns ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Loading previous runs...
                </p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No saved Instagram Post runs yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <button
                      key={run._id}
                      type="button"
                      onClick={() => handleSelectRun(run)}
                      className={`block w-full rounded-xl border p-4 text-left transition hover:border-blue-300 hover:shadow-sm ${
                        selectedRun?._id === run._id
                          ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                          : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                      }`}
                    >
                      <h3 className="line-clamp-1 text-sm font-semibold text-gray-900 dark:text-white">
                        {run.campaign_title}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                        {run.target_audience}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500 dark:text-gray-400">
                        <span>{run.ideas?.length || 0} ideas</span>
                        <span>{formatDate(run.createdAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            {generating ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Generating Instagram Post ideas in background. You can keep this page open while the worker saves the result.
                </p>
              </div>
            ) : !selectedRun ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Output Preview
                </h2>

                <p className="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">
                  Generate a new run or select one from Previous Runs.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                        {selectedRun.platform} / {selectedRun.format}
                      </p>

                      <h2 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                        {selectedRun.campaign_title}
                      </h2>

                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        Created: {formatDate(selectedRun.createdAt)}
                      </p>

                      <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {selectedRun.strategy_summary ||
                          'No strategy summary returned.'}
                      </p>
                    </div>

                    <Button
                      type="button"
                      onClick={handleDeleteRun}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      Ideas
                    </h3>

                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {selectedRun.ideas?.length || 0} total
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {(selectedRun.ideas || []).map((idea, index) => (
                      <button
                        key={idea.id || index}
                        type="button"
                        onClick={() => setSelectedIdeaIndex(index)}
                        className={`rounded-xl border p-4 text-left transition hover:border-blue-300 hover:shadow-sm ${
                          selectedIdeaIndex === index
                            ? 'border-blue-400 bg-blue-50 dark:border-blue-700 dark:bg-blue-950/30'
                            : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                        }`}
                      >
                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          Idea {index + 1} / {idea.post_type}
                        </p>

                        <h4 className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {idea.title}
                        </h4>

                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                          {idea.hook}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedIdea ? (
                  <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                            Selected Post Idea
                          </p>

                          <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                            {selectedIdea.title}
                          </h3>
                        </div>

                        <Button
                          type="button"
                          onClick={() =>
                            copyToClipboard(selectedIdea.creative_prompt)
                          }
                        >
                          Copy Creative Prompt
                        </Button>
                      </div>

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Angle
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-800 dark:text-gray-200">
                            {selectedIdea.angle || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Objective
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-800 dark:text-gray-200">
                            {selectedIdea.objective || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            Hook
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-800 dark:text-gray-200">
                            {selectedIdea.hook || '—'}
                          </p>
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
                          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                            CTA
                          </p>

                          <p className="mt-2 text-sm leading-6 text-gray-800 dark:text-gray-200">
                            {selectedIdea.cta || '—'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Slides
                      </h3>

                      <div className="mt-4 space-y-4">
                        {(selectedIdea.slides || []).map((slide) => (
                          <div
                            key={slide.slide}
                            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <p className="font-semibold text-gray-900 dark:text-white">
                              Slide {slide.slide}
                            </p>

                            <div className="mt-3 grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Visual
                                </p>

                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {slide.visual || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Headline
                                </p>

                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {slide.headline || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Body Text
                                </p>

                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {slide.body_text || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Design Direction
                                </p>

                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {slide.design_direction || '—'}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Creative Production Prompt
                        </h3>

                        <Button
                          type="button"
                          onClick={() =>
                            copyToClipboard(selectedIdea.creative_prompt)
                          }
                        >
                          Copy
                        </Button>
                      </div>

                      <pre className="whitespace-pre-wrap rounded-xl bg-gray-950 p-5 text-sm leading-6 text-gray-100">
                        {selectedIdea.creative_prompt || '—'}
                      </pre>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            Caption
                          </h3>

                          <Button
                            type="button"
                            onClick={() => copyToClipboard(selectedIdea.caption)}
                          >
                            Copy
                          </Button>
                        </div>

                        <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                          {selectedIdea.caption || '—'}
                        </p>

                        {selectedIdea.hashtags?.length ? (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedIdea.hashtags.map((hashtag) => (
                              <span
                                key={hashtag}
                                className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                              >
                                {hashtag}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          Production Notes
                        </h3>

                        {selectedIdea.production_notes?.length ? (
                          <ul className="mt-4 space-y-3">
                            {selectedIdea.production_notes.map((note, index) => (
                              <li
                                key={`${note}-${index}`}
                                className="rounded-xl bg-gray-50 p-3 text-sm leading-6 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {note}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                            No production notes returned.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default InstagramPostIdeasPage;