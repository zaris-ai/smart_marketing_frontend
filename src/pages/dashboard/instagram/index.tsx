import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useState } from 'react';

type StoryFrame = {
  frame: number;
  visual: string;
  on_screen_text: string;
  voiceover: string;
  motion_direction: string;
  duration_seconds: number;
};

type InstagramStoryIdea = {
  id: string;
  title: string;
  angle: string;
  objective: string;
  hook: string;
  story_sequence: StoryFrame[];
  video_prompt: string;
  caption: string;
  cta: string;
  hashtags: string[];
  production_notes: string[];
};

type InstagramStoryRun = {
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
  story_length_seconds: number;
  notes: string;
  ideas: InstagramStoryIdea[];
  markdown?: string;
  createdAt: string;
  updatedAt: string;
};

type InstagramStoryForm = {
  target_audience: string;
  campaign_goal: string;
  campaign_name: string;
  brand_voice: string;
  offer: string;
  key_message: string;
  visual_style: string;
  language: string;
  number_of_ideas: number;
  story_length_seconds: number;
  notes: string;
};

const APP_CONTEXT = {
  brand_name: 'Arka Smart Analyzer',
  app_website_url: 'http://web.arkaanalyzer.com/',
  shopify_app_store_url: 'https://apps.shopify.com/arka-smart-analyzer',
  product_or_service:
    'Shopify analytics app for product, pricing, inventory, and store performance insights.',
};

const initialForm: InstagramStoryForm = {
  target_audience:
    'Shopify store owners who want better business decisions from their store data',
  campaign_goal: 'Generate installs from Shopify merchants',
  campaign_name: 'Find Hidden Store Problems',
  brand_voice: 'direct, expert, practical',
  offer: 'Free install from Shopify App Store',
  key_message: 'Your store data already shows what needs fixing',
  visual_style: 'clean SaaS dashboard visuals, fast cuts, premium tech style',
  language: 'English',
  number_of_ideas: 5,
  story_length_seconds: 15,
  notes:
    'Focus on product performance, dead stock, pricing mistakes, and inventory problems.',
};

const inputClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:focus:border-blue-400 dark:focus:ring-blue-950';

const labelClass =
  'mb-2 block text-sm font-medium text-gray-800 dark:text-gray-200';

const formatDate = (value?: string) => {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
};

const InstagramStoryIdeasPage = () => {
  const [form, setForm] = useState<InstagramStoryForm>(initialForm);
  const [runs, setRuns] = useState<InstagramStoryRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<InstagramStoryRun | null>(null);
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useState(0);

  const [loadingRuns, setLoadingRuns] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const selectedIdea = selectedRun?.ideas?.[selectedIdeaIndex] || null;

  const updateField = <K extends keyof InstagramStoryForm>(
    field: K,
    value: InstagramStoryForm[K]
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

    if (form.story_length_seconds < 5 || form.story_length_seconds > 60) {
      return 'Story length must be between 5 and 60 seconds.';
    }

    return '';
  };

  const loadRuns = async () => {
    try {
      setLoadingRuns(true);
      setError('');

      const response = await api.get('/instagram-agent/story-ideas', {
        params: {
          page: 1,
          limit: 20,
        },
      });

      const items: InstagramStoryRun[] = response?.data?.data?.items || [];

      setRuns(items);

      if (!selectedRun && items.length > 0) {
        setSelectedRun(items[0]);
        setSelectedIdeaIndex(0);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load previous Instagram Story runs.'
      );
    } finally {
      setLoadingRuns(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setGenerating(true);
      setError('');

      const response = await api.post('/instagram-agent/story-ideas', form);
      const data: InstagramStoryRun = response?.data?.data;

      if (!data || !Array.isArray(data.ideas)) {
        throw new Error('Invalid response from Instagram Story agent.');
      }

      setRuns((prev) => [data, ...prev]);
      setSelectedRun(data);
      setSelectedIdeaIndex(0);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to generate Instagram Story ideas.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setForm(initialForm);
    setError('');
  };

  const handleSelectRun = (run: InstagramStoryRun) => {
    setSelectedRun(run);
    setSelectedIdeaIndex(0);
  };

  const handleDeleteRun = async () => {
    if (!selectedRun?._id) return;

    try {
      setDeleting(true);
      setError('');

      await api.delete(`/instagram-agent/story-ideas/${selectedRun._id}`);

      setRuns((prev) => {
        const nextRuns = prev.filter((item) => item._id !== selectedRun._id);
        setSelectedRun(nextRuns[0] || null);
        setSelectedIdeaIndex(0);
        return nextRuns;
      });
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to delete Instagram Story run.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
    } catch {
      setError('Failed to copy text.');
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Instagram Story Idea Agent
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Generate, save, and review Instagram Story ideas for Arka Smart Analyzer.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {runs.length} saved runs
              </p>
            </div>

            <Button type="button" onClick={loadRuns} disabled={loadingRuns || generating}>
              {loadingRuns ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

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
                  New Campaign
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
                  onChange={(event) => updateField('brand_voice', event.target.value)}
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
                  onChange={(event) => updateField('key_message', event.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Visual Style</label>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={form.visual_style}
                  onChange={(event) => updateField('visual_style', event.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <label className={labelClass}>Language</label>
                  <input
                    className={inputClass}
                    value={form.language}
                    onChange={(event) => updateField('language', event.target.value)}
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

                <div>
                  <label className={labelClass}>Seconds</label>
                  <input
                    className={inputClass}
                    type="number"
                    min={5}
                    max={60}
                    value={form.story_length_seconds}
                    onChange={(event) =>
                      updateField('story_length_seconds', Number(event.target.value))
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
                  {generating ? 'Generating...' : 'Generate & Save'}
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
                  No saved Instagram Story runs yet.
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
                  Generating and saving Instagram Story ideas...
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
                        {selectedRun.strategy_summary || 'No strategy summary returned.'}
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
                      {selectedRun.ideas.length} total
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {selectedRun.ideas.map((idea, index) => (
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
                          Idea {index + 1}
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
                            Selected Story Idea
                          </p>

                          <h3 className="mt-2 text-xl font-semibold text-gray-900 dark:text-white">
                            {selectedIdea.title}
                          </h3>
                        </div>

                        <Button
                          type="button"
                          onClick={() => copyToClipboard(selectedIdea.video_prompt)}
                        >
                          Copy Video Prompt
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
                        Story Sequence
                      </h3>

                      <div className="mt-4 space-y-4">
                        {(selectedIdea.story_sequence || []).map((frame) => (
                          <div
                            key={frame.frame}
                            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
                          >
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <p className="font-semibold text-gray-900 dark:text-white">
                                Frame {frame.frame}
                              </p>

                              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                {frame.duration_seconds}s
                              </span>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Visual
                                </p>
                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {frame.visual || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  On-screen Text
                                </p>
                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {frame.on_screen_text || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Voiceover
                                </p>
                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {frame.voiceover || '—'}
                                </p>
                              </div>

                              <div>
                                <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">
                                  Motion
                                </p>
                                <p className="mt-1 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                  {frame.motion_direction || '—'}
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
                          Video Generation Prompt
                        </h3>

                        <Button
                          type="button"
                          onClick={() => copyToClipboard(selectedIdea.video_prompt)}
                        >
                          Copy
                        </Button>
                      </div>

                      <pre className="whitespace-pre-wrap rounded-xl bg-gray-950 p-5 text-sm leading-6 text-gray-100">
                        {selectedIdea.video_prompt || '—'}
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

export default InstagramStoryIdeasPage;