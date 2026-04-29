import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';

type PainCategory = 'conversion' | 'aov' | 'customer';

type ProblemDiscoveryItem = {
    question: string;
    pain_category: PainCategory;
    frequency_score: number;
    source: string;
    source_question_page: string;
    answer: string;
    can_arka_solve: boolean;
    arka_solution: string;
    feature_gap: string;
    recommended_feature: string;
};

type ProblemDiscoverySummary = {
    total_candidates: number;
    accepted_count: number;
};

type ProblemDiscoveryRunDoc = {
    _id: string;
    sourceUrls: string[];
    appReferenceUrl: string;
    maxResults: number;
    items: ProblemDiscoveryItem[];
    summary?: ProblemDiscoverySummary;
    crewName: string;
    rawResult?: any;
    generatedAt?: string;
    createdAt: string;
    updatedAt: string;
};

const DEFAULT_APP_REFERENCE_URL = 'https://apps.shopify.com/arka-smart-analyzer';

const DEFAULT_URLS = [
    'https://community.shopify.com/',
    'https://www.reddit.com/r/shopify/',
];

const EMPTY_FORM = {
    urlsText: DEFAULT_URLS.join('\n'),
    appReferenceUrl: DEFAULT_APP_REFERENCE_URL,
    maxResults: '20',
};

function normalizeUrlsTextToArray(value: string) {
    return (value || '')
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean);
}

function formatScore(value?: number) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '0.00';
    return value.toFixed(2);
}

function categoryBadgeClass(category: PainCategory) {
    if (category === 'conversion') {
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
    }

    if (category === 'aov') {
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300';
    }

    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
}

function sourceBadgeClass(source: string) {
    if (source === 'reddit') {
        return 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300';
    }

    if (source === 'shopify_community') {
        return 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300';
    }

    if (source === 'forum') {
        return 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300';
    }

    if (source === 'blog') {
        return 'bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300';
    }

    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
}

function arkaSolveBadgeClass(value: boolean) {
    return value
        ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
        : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300';
}

function ProblemDiscoveryPage() {
    const [serverError, setServerError] = useState('');
    const [runs, setRuns] = useState<ProblemDiscoveryRunDoc[]>([]);
    const [selectedRun, setSelectedRun] = useState<ProblemDiscoveryRunDoc | null>(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingList, setIsLoadingList] = useState(true);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [form, setForm] = useState(EMPTY_FORM);

    const parsedUrls = useMemo(() => normalizeUrlsTextToArray(form.urlsText), [form.urlsText]);
    const currentRun = selectedRun;

    const summary = currentRun?.summary || {
        total_candidates: currentRun?.items?.length || 0,
        accepted_count: currentRun?.items?.length || 0,
    };

    const fetchRuns = async () => {
        try {
            setIsLoadingList(true);
            setServerError('');

            const response = await api.get('/problem-discovery', {
                params: { limit: 50 },
            });

            const items = response?.data?.data?.items || [];
            setRuns(items);

            if (!selectedRun && items.length > 0) {
                await fetchRunById(items[0]._id);
            }
        } catch (error: any) {
            setServerError(
                error?.response?.data?.message ||
                    error?.response?.data?.detail ||
                    error?.response?.data?.error ||
                    'Failed to fetch problem discovery runs.'
            );
        } finally {
            setIsLoadingList(false);
        }
    };

    const fetchRunById = async (id: string) => {
        try {
            setIsLoadingDetails(true);
            setServerError('');

            const response = await api.get(`/problem-discovery/${id}`);
            const doc = response?.data?.data || null;

            setSelectedRun(doc);
        } catch (error: any) {
            setServerError(
                error?.response?.data?.message ||
                    error?.response?.data?.detail ||
                    error?.response?.data?.error ||
                    'Failed to fetch run details.'
            );
        } finally {
            setIsLoadingDetails(false);
        }
    };

    useEffect(() => {
        fetchRuns();
    }, []);

    const onChangeField = (field: keyof typeof EMPTY_FORM, value: string) => {
        setForm((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const onRunCrew = async () => {
        try {
            setIsSubmitting(true);
            setServerError('');

            const urls = normalizeUrlsTextToArray(form.urlsText);

            if (!urls.length) {
                setServerError('Please provide at least one source URL.');
                return;
            }

            const response = await api.post('/problem-discovery', {
                urls,
                app_reference_url: form.appReferenceUrl.trim() || DEFAULT_APP_REFERENCE_URL,
                max_results: Number(form.maxResults) || 20,
            });

            const doc = response?.data?.data || null;

            if (doc?._id) {
                await fetchRuns();
                await fetchRunById(doc._id);
            }
        } catch (error: any) {
            setServerError(
                error?.response?.data?.message ||
                    error?.response?.data?.detail ||
                    error?.response?.data?.error ||
                    'Failed to run problem discovery.'
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const onDelete = async () => {
        if (!currentRun?._id) return;

        const confirmed = window.confirm('Delete this problem discovery run permanently?');
        if (!confirmed) return;

        try {
            setIsDeleting(true);
            setServerError('');

            const deletingId = currentRun._id;
            await api.delete(`/problem-discovery/${deletingId}`);

            const remaining = runs.filter((item) => item._id !== deletingId);
            setRuns(remaining);

            if (remaining.length > 0) {
                await fetchRunById(remaining[0]._id);
            } else {
                setSelectedRun(null);
            }
        } catch (error: any) {
            setServerError(
                error?.response?.data?.message ||
                    error?.response?.data?.detail ||
                    error?.response?.data?.error ||
                    'Failed to delete problem discovery run.'
            );
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="py-8" dir="ltr">
                <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                            <div>
                                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                                    Problem Discovery
                                </h1>
                                <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                                    Review submitted links, extract the user problems and questions from those pages,
                                    answer them, and assess whether Arka can solve them now or what feature gaps should
                                    be added.
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                <Button type="button" onClick={onRunCrew} isLoading={isSubmitting}>
                                    Run Discovery
                                </Button>

                                <Button
                                    type="button"
                                    onClick={onDelete}
                                    isLoading={isDeleting}
                                    disabled={!currentRun}
                                >
                                    Delete Run
                                </Button>
                            </div>
                        </div>

                        {serverError && (
                            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                                {serverError}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-6 xl:grid-cols-12">
                        <div className="space-y-6 xl:col-span-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Input</h2>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Every submitted link will be reviewed. Use one source link per line.
                                </p>

                                <div className="mt-5 space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Source URLs
                                        </label>
                                        <textarea
                                            rows={8}
                                            value={form.urlsText}
                                            onChange={(e) => onChangeField('urlsText', e.target.value)}
                                            placeholder={`https://community.shopify.com/...
https://www.reddit.com/r/shopify/...`}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                                        />
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Parsed URLs: {parsedUrls.length}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            App Reference URL
                                        </label>
                                        <input
                                            type="text"
                                            value={form.appReferenceUrl}
                                            onChange={(e) => onChangeField('appReferenceUrl', e.target.value)}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                                        />
                                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Used as product truth for Arka fit analysis.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Max Results
                                        </label>
                                        <input
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={form.maxResults}
                                            onChange={(e) => onChangeField('maxResults', e.target.value)}
                                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Saved Runs
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Open any previous discovery run.
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                        {runs.length}
                                    </span>
                                </div>

                                <div className="mt-5 space-y-3">
                                    {isLoadingList && (
                                        <div className="space-y-3">
                                            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                                            <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                                        </div>
                                    )}

                                    {!isLoadingList && runs.length === 0 && (
                                        <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                                            No problem discovery runs saved yet.
                                        </div>
                                    )}

                                    {!isLoadingList &&
                                        runs.map((run) => {
                                            const isActive = currentRun?._id === run._id;
                                            const acceptedCount =
                                                run?.summary?.accepted_count ?? run?.items?.length ?? 0;

                                            return (
                                                <button
                                                    key={run._id}
                                                    type="button"
                                                    onClick={() => fetchRunById(run._id)}
                                                    className={`w-full rounded-2xl border p-4 text-left transition ${
                                                        isActive
                                                            ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800/80'
                                                            : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/60'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                                                Problem Discovery Run
                                                            </h3>
                                                            <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                                                                {run.crewName}
                                                            </p>
                                                        </div>

                                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                            {acceptedCount} items
                                                        </span>
                                                    </div>

                                                    <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                                                        {(run.sourceUrls || []).join(' • ') || 'No source URLs'}
                                                    </p>

                                                    <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                                                        Updated: {new Date(run.updatedAt).toLocaleString()}
                                                    </p>
                                                </button>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 xl:col-span-8">
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Run Details
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Review the selected run, submitted sources, and app reference used for fit
                                            analysis.
                                        </p>
                                    </div>

                                    {currentRun && (
                                        <div className="flex flex-wrap items-center gap-2 text-xs">
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                {currentRun.crewName}
                                            </span>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                {summary.accepted_count} accepted
                                            </span>
                                            <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                {summary.total_candidates} candidates
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {!currentRun && !isLoadingDetails && (
                                    <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                            No run selected
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            Run discovery or open one from the saved list.
                                        </p>
                                    </div>
                                )}

                                {isLoadingDetails && (
                                    <div className="mt-6 space-y-4">
                                        <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                                        <div className="h-64 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                                    </div>
                                )}

                                {currentRun && !isLoadingDetails && (
                                    <div className="mt-6 space-y-6">
                                        <div className="grid gap-4 md:grid-cols-4">
                                            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    Source URLs
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                                                    {currentRun.sourceUrls?.length || 0}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    Accepted Items
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                                                    {summary.accepted_count}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    Candidates
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                                                    {summary.total_candidates}
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                    Max Results
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
                                                    {currentRun.maxResults || 0}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                Submitted Source Pages
                                            </h3>
                                            <div className="mt-4 space-y-3">
                                                {(currentRun.sourceUrls || []).map((url) => (
                                                    <a
                                                        key={url}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="block rounded-xl border border-gray-200 px-4 py-3 text-sm text-blue-600 hover:bg-gray-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-gray-800/60"
                                                    >
                                                        {url}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                                App Reference
                                            </h3>
                                            <a
                                                href={currentRun.appReferenceUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="mt-4 block rounded-xl border border-gray-200 px-4 py-3 text-sm text-blue-600 hover:bg-gray-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-gray-800/60"
                                            >
                                                {currentRun.appReferenceUrl}
                                            </a>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            Extracted Problems and Arka Fit
                                        </h2>
                                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                            Each item includes the question, answer, exact source page, and Arka fit
                                            analysis.
                                        </p>
                                    </div>

                                    {currentRun && (
                                        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                            {currentRun.items?.length || 0} results
                                        </span>
                                    )}
                                </div>

                                {!currentRun && (
                                    <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                            No results to display
                                        </h3>
                                    </div>
                                )}

                                {currentRun && currentRun.items.length === 0 && (
                                    <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                            Empty result set
                                        </h3>
                                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                                            The crew completed, but no valid problem items were accepted.
                                        </p>
                                    </div>
                                )}

                                {currentRun && currentRun.items.length > 0 && (
                                    <div className="mt-5 space-y-4">
                                        {currentRun.items.map((item, index) => (
                                            <div
                                                key={`${item.source_question_page}-${index}`}
                                                className="rounded-2xl border border-gray-200 p-5 dark:border-gray-800"
                                            >
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${categoryBadgeClass(
                                                                item.pain_category
                                                            )}`}
                                                        >
                                                            {item.pain_category}
                                                        </span>

                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${sourceBadgeClass(
                                                                item.source
                                                            )}`}
                                                        >
                                                            {item.source}
                                                        </span>

                                                        <span
                                                            className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${arkaSolveBadgeClass(
                                                                item.can_arka_solve
                                                            )}`}
                                                        >
                                                            {item.can_arka_solve
                                                                ? 'Arka can solve'
                                                                : 'Arka cannot fully solve'}
                                                        </span>

                                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                                            score {formatScore(item.frequency_score)}
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                                                            {item.question}
                                                        </h3>
                                                    </div>

                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                Answer
                                                            </p>
                                                            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                                                {item.answer}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                Arka Solution
                                                            </p>
                                                            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                                                {item.arka_solution || 'No direct current solution identified.'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="grid gap-4 md:grid-cols-2">
                                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                Feature Gap
                                                            </p>
                                                            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                                                {item.feature_gap || 'No major feature gap for this item.'}
                                                            </p>
                                                        </div>

                                                        <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                Recommended Feature
                                                            </p>
                                                            <p className="mt-2 text-sm leading-6 text-gray-700 dark:text-gray-300">
                                                                {item.recommended_feature || 'No additional feature recommendation.'}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                            Source Question Page
                                                        </p>
                                                        <a
                                                            href={item.source_question_page}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-2 block break-all text-sm text-blue-600 hover:underline dark:text-blue-400"
                                                        >
                                                            {item.source_question_page}
                                                        </a>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {currentRun?.rawResult && (
                                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        Raw Result
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                        Useful for debugging the Node ↔ Python contract.
                                    </p>

                                    <pre className="mt-5 max-h-[500px] overflow-auto rounded-2xl bg-gray-950 p-4 text-xs text-gray-100">
                                        {JSON.stringify(currentRun.rawResult, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export const getServerSideProps = withAuth();
export default ProblemDiscoveryPage;