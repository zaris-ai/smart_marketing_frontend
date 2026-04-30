import { DashboardLayout } from '@/components/layouts';
import { Input } from '@/components/ui';
import Pagination, {
  type PaginationMeta,
} from '@/components/common/Pagination';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Store = {
  _id: string;
  name: string;
  domain: string;
  country?: string;
  contactEmail?: string;
  isActive: boolean;
};

type CrmActivityType =
  | 'note'
  | 'email_sent'
  | 'email_reply'
  | 'call'
  | 'meeting'
  | 'follow_up'
  | 'status_change';

type CrmOutcome =
  | 'none'
  | 'positive'
  | 'neutral'
  | 'negative'
  | 'no_response'
  | 'interested'
  | 'not_interested';

type CrmActivity = {
  _id: string;
  store: string;
  type: CrmActivityType;
  title: string;
  body: string;
  emailSent: boolean;
  emailTo?: string;
  emailSubject?: string;
  contactPerson?: string;
  outcome: CrmOutcome;
  nextFollowUpAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type CrmSummary = {
  totalActivities: number;
  hasEmailed: boolean;
  lastActivityAt: string | null;
  lastEmailAt: string | null;
  nextFollowUpAt: string | null;
};

type StoreCrmAnalysisDoc = {
  _id: string;
  store: string;
  storeName: string;
  storeDomain: string;
  title: string;
  crewName: string;
  analysis: {
    crmStatus?: {
      stage?: string;
      hasEmailed?: boolean;
      lastActivityAt?: string | null;
      lastEmailAt?: string | null;
      nextFollowUpAt?: string | null;
      dataQuality?: string;
    };
    score?: {
      priority?: number;
      confidence?: number;
      reason?: string;
    };
    summary?: {
      executiveSummary?: string;
      whatHappened?: string[];
      importantSignals?: string[];
      missingInformation?: string[];
      risks?: string[];
    };
    recommendation?: {
      nextAction?: string;
      recommendedChannel?: string;
      recommendedTiming?: string;
      reason?: string;
    };
    outreach?: {
      subject?: string;
      body?: string;
      angle?: string;
    };
    crmUpdates?: {
      suggestedTags?: string[];
      suggestedOutcome?: string;
      suggestedNote?: string;
    };
  };
  status: 'success' | 'failed';
  error?: string;
  generatedAt: string;
  createdAt: string;
  telegram?: {
    published: boolean;
    channelId: string;
    messageIds: number[];
    publishedAt?: string | null;
    error?: string;
  };
};

type FormState = {
  type: CrmActivityType;
  title: string;
  body: string;
  emailSent: boolean;
  emailTo: string;
  emailSubject: string;
  contactPerson: string;
  outcome: CrmOutcome;
  nextFollowUpAt: string;
};

const defaultFormState: FormState = {
  type: 'note',
  title: '',
  body: '',
  emailSent: false,
  emailTo: '',
  emailSubject: '',
  contactPerson: '',
  outcome: 'none',
  nextFollowUpAt: '',
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function typeLabel(type: CrmActivityType | string) {
  const map: Record<string, string> = {
    note: 'Note',
    email_sent: 'Email Sent',
    email_reply: 'Email Reply',
    call: 'Call',
    meeting: 'Meeting',
    follow_up: 'Follow Up',
    status_change: 'Status Change',
  };

  return map[type] || type;
}

function outcomeLabel(outcome: CrmOutcome | string) {
  const map: Record<string, string> = {
    none: 'None',
    positive: 'Positive',
    neutral: 'Neutral',
    negative: 'Negative',
    no_response: 'No Response',
    interested: 'Interested',
    not_interested: 'Not Interested',
  };

  return map[outcome] || outcome;
}

function renderStringList(items?: string[]) {
  if (!items?.length) {
    return <li>None recorded.</li>;
  }

  return items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>);
}

export default function StoreCrmPage() {
  const router = useRouter();

  const storeId = useMemo(() => {
    const value = router.query.id;
    return typeof value === 'string' ? value : '';
  }, [router.query.id]);

  const [store, setStore] = useState<Store | null>(null);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [latestAnalysis, setLatestAnalysis] =
    useState<StoreCrmAnalysisDoc | null>(null);

  const [form, setForm] = useState<FormState>(defaultFormState);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const fetchCrmActivities = async (
    nextPage = page,
    nextLimit = limit,
    nextSearch = search,
    nextType = typeFilter,
    nextEmailFilter = emailFilter
  ) => {
    if (!storeId) return;

    try {
      setIsRefreshing(true);

      const response = await api.get(`/stores/${storeId}/crm-activities`, {
        params: {
          page: nextPage,
          limit: nextLimit,
          ...(nextSearch ? { q: nextSearch } : {}),
          ...(nextType ? { type: nextType } : {}),
          ...(nextEmailFilter !== ''
            ? { emailSent: nextEmailFilter === 'true' }
            : {}),
        },
      });

      setStore(response?.data?.data?.store || null);
      setSummary(response?.data?.data?.summary || null);
      setActivities(response?.data?.data?.activities || []);
      setPagination(response?.data?.data?.pagination || null);
      setLatestAnalysis(response?.data?.data?.latestAnalysis || null);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to load CRM activities.';

      toast.error(message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;

    fetchCrmActivities(1, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const updateForm = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((current) => {
      const next = {
        ...current,
        [key]: value,
      };

      if (key === 'type' && value === 'email_sent') {
        next.emailSent = true;
      }

      return next;
    });
  };

  const resetForm = () => {
    setForm(defaultFormState);
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!storeId) return;

    if (!form.title.trim() && !form.body.trim()) {
      toast.error('Title or note body is required.');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        ...form,
        nextFollowUpAt: form.nextFollowUpAt || null,
      };

      const response = await api.post(
        `/stores/${storeId}/crm-activities`,
        payload
      );

      toast.success(
        response?.data?.message || 'CRM activity added successfully.'
      );

      resetForm();
      setPage(1);

      await fetchCrmActivities(1, limit);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to add CRM activity.';

      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivity = async (activity: CrmActivity) => {
    const confirmed = window.confirm('Delete this CRM activity?');

    if (!confirmed) return;

    try {
      setDeletingId(activity._id);

      const response = await api.delete(
        `/stores/${storeId}/crm-activities/${activity._id}`
      );

      toast.success(response?.data?.message || 'CRM activity deleted.');

      const nextPage = activities.length === 1 && page > 1 ? page - 1 : page;

      setPage(nextPage);

      await fetchCrmActivities(nextPage, limit);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to delete CRM activity.';

      toast.error(message);
    } finally {
      setDeletingId('');
    }
  };

  const handleAnalyzeCrm = async () => {
    if (!storeId) return;

    const confirmed = window.confirm(
      'Run AI CRM analysis for this store? The result will be saved and published to Telegram if Telegram is configured.'
    );

    if (!confirmed) return;

    try {
      setIsAnalyzing(true);

      const response = await api.post(`/stores/${storeId}/crm-analysis/run`);

      const doc = response?.data?.data || null;

      setLatestAnalysis(doc);

      toast.success(
        response?.data?.message || 'CRM analysis generated successfully.'
      );

      await fetchCrmActivities(page, limit);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to analyze CRM.';

      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setPage(1);
    await fetchCrmActivities(1, limit);
  };

  const handleResetFilters = async () => {
    setSearch('');
    setTypeFilter('');
    setEmailFilter('');
    setPage(1);

    await fetchCrmActivities(1, limit, '', '', '');
  };

  const handlePageChange = async (nextPage: number) => {
    setPage(nextPage);
    await fetchCrmActivities(nextPage, limit);
  };

  const handleLimitChange = async (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);

    await fetchCrmActivities(1, nextLimit);
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2">
                <Link
                  href="/dashboard/stores"
                  className="text-sm text-primary hover:underline"
                >
                  ← Back to Stores
                </Link>
              </div>

              <h1 className="text-2xl font-semibold text-base-content">
                Store CRM
              </h1>

              <p className="mt-1 text-sm text-base-content/70">
                Notes, emails, calls, meetings, follow-ups and AI CRM analysis.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-base-300 bg-base-100 py-20">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : !store ? (
            <div className="alert alert-error">
              <span>Store not found.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm md:col-span-2">
                  <div className="text-sm text-base-content/60">Store</div>

                  <div className="mt-1 text-xl font-semibold">{store.name}</div>

                  <div className="mt-1 text-sm text-base-content/70">
                    {store.domain}
                  </div>

                  <div className="mt-3">
                    {store.isActive ? (
                      <span className="badge badge-success badge-outline">
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-ghost">Inactive</span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="text-sm text-base-content/60">
                    Email Status
                  </div>

                  <div className="mt-2">
                    {summary?.hasEmailed ? (
                      <span className="badge badge-success">Emailed</span>
                    ) : (
                      <span className="badge badge-warning">Not emailed</span>
                    )}
                  </div>

                  <div className="mt-3 text-xs text-base-content/60">
                    Last email: {formatDate(summary?.lastEmailAt)}
                  </div>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="text-sm text-base-content/60">
                    Next Follow-up
                  </div>

                  <div className="mt-2 text-sm font-medium">
                    {formatDate(summary?.nextFollowUpAt)}
                  </div>

                  <div className="mt-3 text-xs text-base-content/60">
                    Activities: {summary?.totalActivities || 0}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">AI CRM Analysis</h2>

                    <p className="mt-1 text-sm text-base-content/70">
                      Analyze this store’s CRM notes, email history, follow-ups
                      and sales state. The result is saved in MongoDB and sent to
                      Telegram if configured.
                    </p>
                  </div>

                  <button
                    type="button"
                    className={`btn btn-primary ${
                      isAnalyzing ? 'btn-disabled' : ''
                    }`}
                    onClick={handleAnalyzeCrm}
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze CRM'}
                  </button>
                </div>

                {isAnalyzing && (
                  <div className="mt-5 flex items-center gap-2 text-sm text-base-content/70">
                    <span className="loading loading-spinner loading-sm" />
                    Running CRM crew, saving result, and publishing to
                    Telegram...
                  </div>
                )}

                {!latestAnalysis ? (
                  <div className="mt-5 rounded-xl border border-dashed border-base-300 bg-base-200/40 p-5 text-sm text-base-content/70">
                    No CRM analysis saved yet.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Stage
                        </div>
                        <div className="mt-1 font-semibold">
                          {latestAnalysis.analysis?.crmStatus?.stage ||
                            'unknown'}
                        </div>
                      </div>

                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Priority
                        </div>
                        <div className="mt-1 font-semibold">
                          {latestAnalysis.analysis?.score?.priority ?? '-'} /
                          100
                        </div>
                      </div>

                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Confidence
                        </div>
                        <div className="mt-1 font-semibold">
                          {latestAnalysis.analysis?.score?.confidence ?? '-'} /
                          100
                        </div>
                      </div>

                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Telegram
                        </div>
                        <div className="mt-1">
                          {latestAnalysis.telegram?.published ? (
                            <span className="badge badge-success">
                              Published
                            </span>
                          ) : (
                            <span className="badge badge-warning">
                              Not published
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold">Executive Summary</h3>
                      <p className="mt-2 text-sm leading-6 text-base-content/80">
                        {latestAnalysis.analysis?.summary?.executiveSummary ||
                          '-'}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      <div>
                        <h3 className="font-semibold">Recommendation</h3>

                        <div className="mt-2 rounded-xl border border-base-300 p-4 text-sm">
                          <div>
                            <span className="text-base-content/60">
                              Next action:
                            </span>{' '}
                            {latestAnalysis.analysis?.recommendation
                              ?.nextAction || '-'}
                          </div>

                          <div className="mt-1">
                            <span className="text-base-content/60">
                              Channel:
                            </span>{' '}
                            {latestAnalysis.analysis?.recommendation
                              ?.recommendedChannel || '-'}
                          </div>

                          <div className="mt-1">
                            <span className="text-base-content/60">
                              Timing:
                            </span>{' '}
                            {latestAnalysis.analysis?.recommendation
                              ?.recommendedTiming || '-'}
                          </div>

                          <p className="mt-3 text-base-content/80">
                            {latestAnalysis.analysis?.recommendation?.reason ||
                              ''}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold">Suggested Outreach</h3>

                        <div className="mt-2 rounded-xl border border-base-300 p-4 text-sm">
                          <div>
                            <span className="text-base-content/60">
                              Subject:
                            </span>{' '}
                            {latestAnalysis.analysis?.outreach?.subject || '-'}
                          </div>

                          <div className="mt-1">
                            <span className="text-base-content/60">
                              Angle:
                            </span>{' '}
                            {latestAnalysis.analysis?.outreach?.angle || '-'}
                          </div>

                          <p className="mt-3 whitespace-pre-wrap text-base-content/80">
                            {latestAnalysis.analysis?.outreach?.body || ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                      <div>
                        <h3 className="font-semibold">Important Signals</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                          {renderStringList(
                            latestAnalysis.analysis?.summary?.importantSignals
                          )}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-semibold">Missing Information</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                          {renderStringList(
                            latestAnalysis.analysis?.summary?.missingInformation
                          )}
                        </ul>
                      </div>

                      <div>
                        <h3 className="font-semibold">Risks</h3>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-base-content/80">
                          {renderStringList(
                            latestAnalysis.analysis?.summary?.risks
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-200/50 p-4 text-sm">
                      <div>
                        <span className="text-base-content/60">
                          Generated:
                        </span>{' '}
                        {formatDate(
                          latestAnalysis.generatedAt ||
                            latestAnalysis.createdAt
                        )}
                      </div>

                      {latestAnalysis.telegram?.publishedAt && (
                        <div className="mt-1">
                          <span className="text-base-content/60">
                            Telegram published:
                          </span>{' '}
                          {formatDate(latestAnalysis.telegram.publishedAt)}
                        </div>
                      )}

                      {latestAnalysis.telegram?.error && (
                        <div className="mt-1 text-error">
                          Telegram error: {latestAnalysis.telegram.error}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm lg:col-span-1">
                  <h2 className="text-lg font-semibold">Add CRM Activity</h2>

                  <form
                    onSubmit={handleSubmitActivity}
                    className="mt-5 space-y-4"
                  >
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Type</span>
                      </label>

                      <select
                        className="select select-bordered w-full"
                        value={form.type}
                        onChange={(e) =>
                          updateForm('type', e.target.value as CrmActivityType)
                        }
                      >
                        <option value="note">Note</option>
                        <option value="email_sent">Email Sent</option>
                        <option value="email_reply">Email Reply</option>
                        <option value="call">Call</option>
                        <option value="meeting">Meeting</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="status_change">Status Change</option>
                      </select>
                    </div>

                    <Input
                      value={form.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateForm('title', e.target.value)
                      }
                      type="text"
                      label="Title"
                      placeholder="Example: First outreach email sent"
                      dir="ltr"
                    />

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Note</span>
                      </label>

                      <textarea
                        className="textarea textarea-bordered min-h-[120px]"
                        value={form.body}
                        onChange={(e) => updateForm('body', e.target.value)}
                        placeholder="Write CRM note..."
                        dir="ltr"
                      />
                    </div>

                    <Input
                      value={form.contactPerson}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateForm('contactPerson', e.target.value)
                      }
                      type="text"
                      label="Contact Person"
                      placeholder="John Doe"
                      dir="ltr"
                    />

                    <Input
                      value={form.emailTo}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateForm('emailTo', e.target.value)
                      }
                      type="email"
                      label="Email To"
                      placeholder="team@example.com"
                      dir="ltr"
                    />

                    <Input
                      value={form.emailSubject}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateForm('emailSubject', e.target.value)
                      }
                      type="text"
                      label="Email Subject"
                      placeholder="Partnership opportunity"
                      dir="ltr"
                    />

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Outcome</span>
                      </label>

                      <select
                        className="select select-bordered w-full"
                        value={form.outcome}
                        onChange={(e) =>
                          updateForm('outcome', e.target.value as CrmOutcome)
                        }
                      >
                        <option value="none">None</option>
                        <option value="positive">Positive</option>
                        <option value="neutral">Neutral</option>
                        <option value="negative">Negative</option>
                        <option value="no_response">No Response</option>
                        <option value="interested">Interested</option>
                        <option value="not_interested">Not Interested</option>
                      </select>
                    </div>

                    <Input
                      value={form.nextFollowUpAt}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        updateForm('nextFollowUpAt', e.target.value)
                      }
                      type="datetime-local"
                      label="Next Follow-up"
                      dir="ltr"
                    />

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-primary"
                          checked={form.emailSent}
                          onChange={(e) =>
                            updateForm('emailSent', e.target.checked)
                          }
                        />
                        <span className="label-text">
                          Mark as emailed store
                        </span>
                      </label>
                    </div>

                    <button
                      type="submit"
                      className={`btn btn-primary w-full ${
                        isSubmitting ? 'btn-disabled' : ''
                      }`}
                    >
                      {isSubmitting ? 'Saving...' : 'Save CRM Activity'}
                    </button>
                  </form>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
                  <div className="border-b border-base-300 p-6">
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold">CRM Timeline</h2>
                        <p className="mt-1 text-sm text-base-content/70">
                          Complete activity history for this store.
                        </p>
                      </div>

                      {isRefreshing && (
                        <span className="loading loading-spinner loading-sm" />
                      )}
                    </div>

                    <form
                      onSubmit={handleSearch}
                      className="grid grid-cols-1 gap-3 md:grid-cols-4"
                    >
                      <div className="md:col-span-2">
                        <Input
                          value={search}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setSearch(e.target.value)
                          }
                          type="text"
                          label="Search"
                          placeholder="Search notes, subject, contact..."
                          dir="ltr"
                        />
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Type</span>
                        </label>

                        <select
                          className="select select-bordered"
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          <option value="note">Note</option>
                          <option value="email_sent">Email Sent</option>
                          <option value="email_reply">Email Reply</option>
                          <option value="call">Call</option>
                          <option value="meeting">Meeting</option>
                          <option value="follow_up">Follow Up</option>
                          <option value="status_change">Status Change</option>
                        </select>
                      </div>

                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Email</span>
                        </label>

                        <select
                          className="select select-bordered"
                          value={emailFilter}
                          onChange={(e) => setEmailFilter(e.target.value)}
                        >
                          <option value="">All</option>
                          <option value="true">Emailed</option>
                          <option value="false">Not emailed</option>
                        </select>
                      </div>

                      <div className="flex justify-end gap-2 md:col-span-4">
                        <button type="submit" className="btn btn-outline">
                          Search
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={handleResetFilters}
                        >
                          Reset
                        </button>
                      </div>
                    </form>
                  </div>

                  {activities.length === 0 ? (
                    <div className="p-10 text-center">
                      <h3 className="text-lg font-medium">
                        No CRM activities yet
                      </h3>

                      <p className="mt-2 text-sm text-base-content/70">
                        Add the first note, email, call, meeting or follow-up.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-base-300">
                      {activities.map((activity) => (
                        <div key={activity._id} className="p-6">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="badge badge-outline">
                                  {typeLabel(activity.type)}
                                </span>

                                {activity.emailSent && (
                                  <span className="badge badge-success">
                                    Emailed
                                  </span>
                                )}

                                {activity.outcome !== 'none' && (
                                  <span className="badge badge-neutral">
                                    {outcomeLabel(activity.outcome)}
                                  </span>
                                )}
                              </div>

                              <h3 className="mt-3 text-lg font-semibold">
                                {activity.title || typeLabel(activity.type)}
                              </h3>

                              <div className="mt-1 text-xs text-base-content/60">
                                Created: {formatDate(activity.createdAt)}
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`btn btn-sm btn-error btn-outline ${
                                deletingId === activity._id ? 'btn-disabled' : ''
                              }`}
                              onClick={() => handleDeleteActivity(activity)}
                            >
                              {deletingId === activity._id
                                ? 'Deleting...'
                                : 'Delete'}
                            </button>
                          </div>

                          {activity.body && (
                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-base-content/80">
                              {activity.body}
                            </p>
                          )}

                          <div className="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
                            {activity.contactPerson && (
                              <div>
                                <span className="text-base-content/60">
                                  Contact:
                                </span>{' '}
                                {activity.contactPerson}
                              </div>
                            )}

                            {activity.emailTo && (
                              <div>
                                <span className="text-base-content/60">
                                  Email To:
                                </span>{' '}
                                {activity.emailTo}
                              </div>
                            )}

                            {activity.emailSubject && (
                              <div>
                                <span className="text-base-content/60">
                                  Subject:
                                </span>{' '}
                                {activity.emailSubject}
                              </div>
                            )}

                            {activity.nextFollowUpAt && (
                              <div>
                                <span className="text-base-content/60">
                                  Next Follow-up:
                                </span>{' '}
                                {formatDate(activity.nextFollowUpAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Pagination
                    pagination={pagination}
                    isLoading={isRefreshing || isLoading}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();