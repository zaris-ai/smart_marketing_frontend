import CrmFunnelCalendar from '@/components/dashboard/crm/CrmFunnelCalendar';
import StoreTrackingTrend from '@/components/dashboard/crm/StoreTrackingTrend';
import { DashboardLayout } from '@/components/layouts';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type StoreCrm = {
  funnelStage?: string;
  leadStatus?: string;
  fitScore?: number;
  priority?: string;
  painAngle?: string;
  notes?: string;
  lastContactedAt?: string | null;
  lastRepliedAt?: string | null;
  lastActivityAt?: string | null;
  nextFollowUpAt?: string | null;
  installLinkSentAt?: string | null;
  installedAt?: string | null;
  activatedAt?: string | null;
  retainedAt?: string | null;
  wonAt?: string | null;
  lostAt?: string | null;
  lostReason?: string;
};

type StoreLead = {
  _id: string;
  name: string;
  domain: string;
  platform?: string;
  country?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  isActive?: boolean;
  isChecked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  crm?: StoreCrm;
  metadata?: {
    contactDiscovery?: {
      primaryEmail?: string;
      status?: string;
      summary?: {
        emailCount?: number;
        phoneCount?: number;
        socialProfileCount?: number;
        contactFormCount?: number;
      };
    };
  };
};

type FunnelEvent = {
  _id: string;
  type: string;
  title?: string;
  description?: string;
  previousStage?: string;
  nextStage?: string;
  previousStatus?: string;
  nextStatus?: string;
  channel?: string;
  createdAt?: string;
};

type CrmTask = {
  _id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  dueAt?: string | null;
  completedAt?: string | null;
  createdAt?: string;
};

type Pagination = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type SummaryItem = {
  _id: string;
  count: number;
};

type Summary = {
  total: number;
  hasEmail: number;
  noEmail: number;
  openTasks: number;
  overdueTasks: number;
  byStage: SummaryItem[];
  byStatus: SummaryItem[];
  byPainAngle: SummaryItem[];
  byPriority: SummaryItem[];
};

type Meta = {
  stages: string[];
  statuses: string[];
  painAngles: string[];
  priorities: string[];
  eventTypes: string[];
  taskTypes: string[];
  taskStatuses: string[];
  taskPriorities: string[];
};

type FunnelForm = {
  funnelStage: string;
  leadStatus: string;
  fitScore: number;
  priority: string;
  painAngle: string;
  nextFollowUpAt: string;
  lostReason: string;
  notes: string;
  eventType: string;
  eventDescription: string;
};

type TaskForm = {
  title: string;
  description: string;
  type: string;
  priority: string;
  dueAt: string;
};

type ViewMode = 'tracking' | 'calendar' | 'board' | 'list';

const fallbackMeta: Meta = {
  stages: [
    'discovered',
    'qualified',
    'contacted',
    'engaged',
    'installed',
    'activated',
    'won',
    'lost',
  ],
  statuses: [
    'new',
    'researching',
    'qualified',
    'email_sent',
    'no_reply',
    'replied',
    'install_sent',
    'installed',
    'active',
    'won',
    'lost',
    'unqualified',
  ],
  painAngles: [
    'unknown',
    'analytics_pain',
    'dashboard_fatigue',
    'campaign_performance',
    'product_performance',
    'weekly_reporting',
    'custom',
  ],
  priorities: ['low', 'medium', 'high'],
  eventTypes: [
    'manual_note',
    'stage_changed',
    'status_changed',
    'email_sent',
    'email_failed',
    'email_bounced',
    'email_replied',
    'reply_positive',
    'reply_neutral',
    'reply_negative',
    'follow_up_created',
    'install_link_sent',
    'app_installed',
    'app_opened',
    'data_synced',
    'dashboard_viewed',
    'insight_viewed',
    'activated',
    'won',
    'lost',
  ],
  taskTypes: [
    'follow_up',
    'send_email',
    'send_install_link',
    'book_demo',
    'onboarding_follow_up',
    'manual_review',
    'other',
  ],
  taskStatuses: ['open', 'in_progress', 'completed', 'cancelled'],
  taskPriorities: ['low', 'medium', 'high'],
};

const initialPagination: Pagination = {
  page: 1,
  limit: 30,
  totalDocs: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

const initialSummary: Summary = {
  total: 0,
  hasEmail: 0,
  noEmail: 0,
  openTasks: 0,
  overdueTasks: 0,
  byStage: [],
  byStatus: [],
  byPainAngle: [],
  byPriority: [],
};

const initialFunnelForm: FunnelForm = {
  funnelStage: 'discovered',
  leadStatus: 'new',
  fitScore: 0,
  priority: 'medium',
  painAngle: 'unknown',
  nextFollowUpAt: '',
  lostReason: '',
  notes: '',
  eventType: 'stage_changed',
  eventDescription: '',
};

const initialTaskForm: TaskForm = {
  title: '',
  description: '',
  type: 'follow_up',
  priority: 'medium',
  dueAt: '',
};

const taskTemplateOptions = [
  {
    label: 'Follow up',
    type: 'follow_up',
    title: 'Follow up with merchant',
    description: 'Follow up because there was no reply or the conversation needs the next step.',
  },
  {
    label: 'Send email',
    type: 'send_email',
    title: 'Send outreach email',
    description: 'Send a personalized email based on the store pain angle and current CRM stage.',
  },
  {
    label: 'Install link',
    type: 'send_install_link',
    title: 'Send install link',
    description: 'Send the app install link and explain what the merchant should do next.',
  },
  {
    label: 'Book demo',
    type: 'book_demo',
    title: 'Book product demo',
    description: 'Schedule a short demo and answer product or analytics questions.',
  },
  {
    label: 'Manual review',
    type: 'manual_review',
    title: 'Review store manually',
    description: 'Review the store context, contact quality, CRM stage, and next best action.',
  },
];

const quickDueOptions = [
  { label: 'Today 17:00', days: 0, hour: 17, minute: 0 },
  { label: 'Tomorrow 09:00', days: 1, hour: 9, minute: 0 },
  { label: 'Tomorrow 14:00', days: 1, hour: 14, minute: 0 },
  { label: 'In 3 days', days: 3, hour: 9, minute: 0 },
  { label: 'Next week', days: 7, hour: 9, minute: 0 },
];

const VIEW_HASHES: Record<ViewMode, string> = {
  tracking: 'tracking',
  calendar: 'calendar',
  board: 'board',
  list: 'list',
};

function normalizeViewHash(value?: string | null): ViewMode {
  const cleanValue = String(value || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();

  if (cleanValue === 'tracking') return 'tracking';
  if (cleanValue === 'calendar') return 'calendar';
  if (cleanValue === 'board') return 'board';
  if (cleanValue === 'list') return 'list';

  return 'list';
}

function getCurrentHashView(): ViewMode {
  if (typeof window === 'undefined') return 'list';

  return normalizeViewHash(window.location.hash);
}

function setUrlHashForView(view: ViewMode) {
  if (typeof window === 'undefined') return;

  const nextHash = `#${VIEW_HASHES[view]}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;

  if (currentUrl !== nextUrl) {
    window.history.replaceState(null, '', nextUrl);
  }
}

function humanize(value?: string | null) {
  if (!value) return '-';

  return String(value)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    fallback
  );
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
}

function toDateTimeInput(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function getSuggestedDueAt(days: number, hour: number, minute: number) {
  const date = new Date();

  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);

  return toDateTimeInput(date.toISOString());
}

function getPrimaryEmail(store: StoreLead) {
  return store.contactEmail || store.metadata?.contactDiscovery?.primaryEmail || '';
}

function getStageBadgeClass(stage?: string) {
  if (['won', 'activated'].includes(stage || '')) {
    return 'badge-success';
  }

  if (stage === 'lost') return 'badge-error';

  if (['contacted', 'engaged'].includes(stage || '')) {
    return 'badge-info';
  }

  if (stage === 'installed') {
    return 'badge-secondary';
  }

  if (stage === 'qualified') {
    return 'badge-primary';
  }

  return 'badge-ghost';
}

function getStatusBadgeClass(status?: string) {
  if (['replied', 'active', 'won', 'qualified'].includes(status || '')) {
    return 'badge-success';
  }

  if (['lost', 'unqualified'].includes(status || '')) {
    return 'badge-error';
  }

  if (['email_sent', 'no_reply', 'install_sent'].includes(status || '')) {
    return 'badge-warning';
  }

  if (['installed'].includes(status || '')) {
    return 'badge-info';
  }

  return 'badge-ghost';
}

function getPriorityBadgeClass(priority?: string) {
  if (priority === 'high') return 'badge-error';
  if (priority === 'low') return 'badge-ghost';

  return 'badge-warning';
}

function CrmFunnelPage() {
  const router = useRouter();

  const [meta, setMeta] = useState<Meta>(fallbackMeta);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [stores, setStores] = useState<StoreLead[]>([]);
  const [pagination, setPagination] = useState<Pagination>(initialPagination);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [painAngleFilter, setPainAngleFilter] = useState('');
  const [hasEmailFilter, setHasEmailFilter] = useState('');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const [trackingStore, setTrackingStore] = useState<StoreLead | null>(null);
  const [trackingEvents, setTrackingEvents] = useState<FunnelEvent[]>([]);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [modalMode, setModalMode] = useState<'details' | 'funnel' | 'task' | null>(null);
  const [activeStore, setActiveStore] = useState<StoreLead | null>(null);

  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);

  const [funnelForm, setFunnelForm] = useState<FunnelForm>(initialFunnelForm);
  const [taskForm, setTaskForm] = useState<TaskForm>(initialTaskForm);

  const [isSavingFunnel, setIsSavingFunnel] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [actingTaskId, setActingTaskId] = useState('');

  const changeViewMode = (nextViewMode: ViewMode) => {
    setViewMode(nextViewMode);
    setUrlHashForView(nextViewMode);
  };

  const stageCounts = useMemo(() => {
    return summary.byStage.reduce<Record<string, number>>((acc, item) => {
      acc[item._id || 'discovered'] = item.count;
      return acc;
    }, {});
  }, [summary.byStage]);

  const boardStoresByStage = useMemo(() => {
    return stores.reduce<Record<string, StoreLead[]>>((acc, store) => {
      const stage = store.crm?.funnelStage || 'discovered';

      if (!acc[stage]) {
        acc[stage] = [];
      }

      acc[stage].push(store);

      return acc;
    }, {});
  }, [stores]);

  const visibleStages = stageFilter ? [stageFilter] : meta.stages;

  const loadMeta = async () => {
    try {
      const response = await api.get('/crm-funnel/meta');

      setMeta({
        ...fallbackMeta,
        ...(response?.data?.data || {}),
      });
    } catch {
      setMeta(fallbackMeta);
    }
  };

  const loadSummary = async () => {
    try {
      const response = await api.get('/crm-funnel/summary');

      setSummary(response?.data?.data || initialSummary);
    } catch {
      setSummary(initialSummary);
    }
  };

  const loadStores = async (nextPage = page, silent = false) => {
    try {
      setError('');

      if (!silent) {
        setIsLoading(true);
      }

      const response = await api.get('/crm-funnel/stores', {
        params: {
          page: nextPage,
          limit,
          ...(search ? { q: search } : {}),
          ...(stageFilter ? { stage: stageFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(priorityFilter ? { priority: priorityFilter } : {}),
          ...(painAngleFilter ? { painAngle: painAngleFilter } : {}),
          ...(hasEmailFilter ? { hasEmail: hasEmailFilter } : {}),
          sortBy,
          sortOrder,
        },
      });

      setStores(response?.data?.data?.stores || []);
      setPagination(response?.data?.data?.pagination || initialPagination);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load CRM funnel stores.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const loadTrackingStore = async (store: StoreLead | null) => {
    setTrackingStore(store);
    setTrackingEvents([]);

    if (!store?._id) return;

    try {
      setIsTrackingLoading(true);

      const response = await api.get(`/crm-funnel/stores/${store._id}/events`, {
        params: {
          page: 1,
          limit: 100,
        },
      });

      setTrackingEvents(response?.data?.data?.events || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load store tracking history.'));
    } finally {
      setIsTrackingLoading(false);
    }
  };

  const refreshAll = async () => {
    setIsRefreshing(true);

    await Promise.all([loadSummary(), loadStores(page, true)]);

    if (trackingStore) {
      await loadTrackingStore(trackingStore);
    }

    setIsRefreshing(false);
  };

  const resetFilters = () => {
    setSearch('');
    setStageFilter('');
    setStatusFilter('');
    setPriorityFilter('');
    setPainAngleFilter('');
    setHasEmailFilter('');
    setSortBy('updatedAt');
    setSortOrder('desc');
    setPage(1);
  };

  const openFunnelModal = (store: StoreLead) => {
    setActiveStore(store);
    setModalMode('funnel');

    setFunnelForm({
      funnelStage: store.crm?.funnelStage || 'discovered',
      leadStatus: store.crm?.leadStatus || 'new',
      fitScore: store.crm?.fitScore || 0,
      priority: store.crm?.priority || 'medium',
      painAngle: store.crm?.painAngle || 'unknown',
      nextFollowUpAt: toDateTimeInput(store.crm?.nextFollowUpAt),
      lostReason: store.crm?.lostReason || '',
      notes: store.crm?.notes || '',
      eventType: 'stage_changed',
      eventDescription: '',
    });
  };

  const openTaskModal = (store: StoreLead) => {
    setActiveStore(store);
    setModalMode('task');

    setTaskForm({
      ...initialTaskForm,
      priority: store.crm?.priority || 'medium',
    });
  };

  const openDetailsModal = async (store: StoreLead) => {
    setActiveStore(store);
    setModalMode('details');
    setIsDetailsLoading(true);
    setEvents([]);
    setTasks([]);

    try {
      const [eventsResponse, tasksResponse] = await Promise.all([
        api.get(`/crm-funnel/stores/${store._id}/events`, {
          params: { page: 1, limit: 50 },
        }),
        api.get(`/crm-funnel/stores/${store._id}/tasks`),
      ]);

      setEvents(eventsResponse?.data?.data?.events || []);
      setTasks(tasksResponse?.data?.data?.tasks || []);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load CRM details.'));
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const openDetailsByStoreId = async (storeId: string) => {
    try {
      const existingStore = stores.find((store) => store._id === storeId);

      if (existingStore) {
        await openDetailsModal(existingStore);
        return;
      }

      const response = await api.get(`/crm-funnel/stores/${storeId}`);
      const store = response?.data?.data?.store;

      if (!store) {
        toast.error('Store not found.');
        return;
      }

      await openDetailsModal(store);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to open store details.'));
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveStore(null);
    setEvents([]);
    setTasks([]);
    setFunnelForm(initialFunnelForm);
    setTaskForm(initialTaskForm);
  };

  const submitFunnelUpdate = async () => {
    if (!activeStore?._id) return;

    try {
      setIsSavingFunnel(true);

      await api.patch(`/crm-funnel/stores/${activeStore._id}/funnel`, {
        ...funnelForm,
        nextFollowUpAt: funnelForm.nextFollowUpAt || null,
      });

      toast.success('Funnel updated successfully.');

      const updatedStoreId = activeStore._id;

      closeModal();

      await Promise.all([loadSummary(), loadStores(page, true)]);

      if (trackingStore?._id === updatedStoreId) {
        await loadTrackingStore(trackingStore);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update funnel.'));
    } finally {
      setIsSavingFunnel(false);
    }
  };

  const submitTask = async () => {
    if (!activeStore?._id) return;

    if (!taskForm.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    try {
      setIsSavingTask(true);

      await api.post(`/crm-funnel/stores/${activeStore._id}/tasks`, {
        ...taskForm,
        dueAt: taskForm.dueAt || null,
      });

      toast.success('CRM task created successfully.');

      closeModal();

      await Promise.all([loadSummary(), loadStores(page, true)]);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to create task.'));
    } finally {
      setIsSavingTask(false);
    }
  };

  const completeTask = async (task: CrmTask) => {
    try {
      setActingTaskId(task._id);

      await api.patch(`/crm-funnel/tasks/${task._id}`, {
        status: 'completed',
      });

      toast.success('Task completed.');

      if (activeStore) {
        await openDetailsModal(activeStore);
      }

      await loadSummary();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to complete task.'));
    } finally {
      setActingTaskId('');
    }
  };

  useEffect(() => {
    loadMeta();
    loadSummary();
  }, []);

  useEffect(() => {
    if (!router.isReady) return;

    const q = router.query.q;
    const stage = router.query.stage;
    const status = router.query.status;

    if (typeof q === 'string') setSearch(q);
    if (typeof stage === 'string') setStageFilter(stage);
    if (typeof status === 'string') setStatusFilter(status);
  }, [router.isReady, router.query.q, router.query.stage, router.query.status]);

  useEffect(() => {
    const syncViewFromHash = () => {
      const nextView = getCurrentHashView();

      setViewMode(nextView);

      if (!window.location.hash) {
        setUrlHashForView('list');
      }
    };

    syncViewFromHash();

    window.addEventListener('hashchange', syncViewFromHash);

    return () => {
      window.removeEventListener('hashchange', syncViewFromHash);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStores(page, false);
    }, 250);

    return () => clearTimeout(timer);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    limit,
    search,
    stageFilter,
    statusFilter,
    priorityFilter,
    painAngleFilter,
    hasEmailFilter,
    sortBy,
    sortOrder,
  ]);

  return (
    <DashboardLayout>
      <Head>
        <title>CRM Funnel | Marketing Assistant Panel</title>
      </Head>

      <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
        <div className="mx-auto max-w-[1600px] space-y-6 px-4 md:px-6">
          <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 p-5 md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-base-content md:text-3xl">
                      CRM Funnel
                    </h1>

                    <span className="badge badge-primary badge-outline">
                      Store Tracking
                    </span>

                    <span className="badge badge-info badge-outline">
                      Shopify Stores
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm text-base-content/70">
                    Track each store through the lean Arka outreach funnel: discovery,
                    qualification, outreach, engagement, install, activation, won, or lost.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href="/dashboard/stores" className="btn btn-outline">
                    Back to Stores
                  </Link>

                  <button
                    type="button"
                    className={`btn btn-primary ${isRefreshing ? 'btn-disabled' : ''}`}
                    onClick={refreshAll}
                  >
                    {isRefreshing ? (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        Refreshing
                      </>
                    ) : (
                      'Refresh'
                    )}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">
                    Total Leads
                  </div>
                  <div className="mt-1 text-2xl font-bold">{summary.total}</div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-primary">
                    With Email
                  </div>
                  <div className="mt-1 text-2xl font-bold">{summary.hasEmail}</div>
                </div>

                <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-warning">
                    No Email
                  </div>
                  <div className="mt-1 text-2xl font-bold">{summary.noEmail}</div>
                </div>

                <div className="rounded-2xl border border-info/20 bg-info/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-info">
                    Open Tasks
                  </div>
                  <div className="mt-1 text-2xl font-bold">{summary.openTasks}</div>
                </div>

                <div className="rounded-2xl border border-error/20 bg-error/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-error">
                    Overdue
                  </div>
                  <div className="mt-1 text-2xl font-bold text-error">
                    {summary.overdueTasks}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5 md:p-7">
              <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Funnel Stages</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                      Click a stage to filter tracking, board, calendar, and lead list.
                    </p>
                  </div>

                  {stageFilter && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setStageFilter('');
                        setPage(1);
                      }}
                    >
                      Clear stage filter
                    </button>
                  )}
                </div>

                <div className="flex gap-3 overflow-x-auto pb-2">
                  {meta.stages.map((stage) => (
                    <button
                      key={stage}
                      type="button"
                      className={`min-w-[170px] rounded-2xl border p-4 text-left transition ${stageFilter === stage
                        ? 'border-primary bg-primary/10'
                        : 'border-base-300 bg-base-200/50 hover:bg-base-200'
                        }`}
                      onClick={() => {
                        setStageFilter((current) => (current === stage ? '' : stage));
                        setPage(1);
                      }}
                    >
                      <div className="text-sm font-semibold text-base-content">
                        {humanize(stage)}
                      </div>

                      <div className="mt-2 text-2xl font-bold text-primary">
                        {stageCounts[stage] || 0}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="form-control lg:col-span-4">
                    <label className="label" htmlFor="crm-search">
                      <span className="label-text">Search</span>
                    </label>

                    <input
                      id="crm-search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      className="input input-bordered w-full bg-base-100"
                      placeholder="Search store, domain, contact, email"
                      dir="ltr"
                    />
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-stage">
                      <span className="label-text">Stage</span>
                    </label>

                    <select
                      id="crm-stage"
                      className="select select-bordered bg-base-100"
                      value={stageFilter}
                      onChange={(event) => {
                        setStageFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All stages</option>
                      {meta.stages.map((stage) => (
                        <option key={stage} value={stage}>
                          {humanize(stage)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-status">
                      <span className="label-text">Lead Status</span>
                    </label>

                    <select
                      id="crm-status"
                      className="select select-bordered bg-base-100"
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All statuses</option>
                      {meta.statuses.map((status) => (
                        <option key={status} value={status}>
                          {humanize(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-priority">
                      <span className="label-text">Priority</span>
                    </label>

                    <select
                      id="crm-priority"
                      className="select select-bordered bg-base-100"
                      value={priorityFilter}
                      onChange={(event) => {
                        setPriorityFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All priorities</option>
                      {meta.priorities.map((priority) => (
                        <option key={priority} value={priority}>
                          {humanize(priority)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-has-email">
                      <span className="label-text">Email</span>
                    </label>

                    <select
                      id="crm-has-email"
                      className="select select-bordered bg-base-100"
                      value={hasEmailFilter}
                      onChange={(event) => {
                        setHasEmailFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">Any</option>
                      <option value="true">Has email</option>
                      <option value="false">No email</option>
                    </select>
                  </div>

                  <div className="form-control lg:col-span-3">
                    <label className="label" htmlFor="crm-pain-angle">
                      <span className="label-text">Pain Angle</span>
                    </label>

                    <select
                      id="crm-pain-angle"
                      className="select select-bordered bg-base-100"
                      value={painAngleFilter}
                      onChange={(event) => {
                        setPainAngleFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="">All pain angles</option>
                      {meta.painAngles.map((angle) => (
                        <option key={angle} value={angle}>
                          {humanize(angle)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-sort-by">
                      <span className="label-text">Sort Field</span>
                    </label>

                    <select
                      id="crm-sort-by"
                      className="select select-bordered bg-base-100"
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                    >
                      <option value="updatedAt">Updated</option>
                      <option value="createdAt">Created</option>
                      <option value="crm.fitScore">Fit Score</option>
                      <option value="crm.lastActivityAt">Last Activity</option>
                      <option value="crm.nextFollowUpAt">Next Follow-up</option>
                      <option value="name">Name</option>
                      <option value="domain">Domain</option>
                    </select>
                  </div>

                  <div className="form-control lg:col-span-2">
                    <label className="label" htmlFor="crm-sort-order">
                      <span className="label-text">Sort Order</span>
                    </label>

                    <select
                      id="crm-sort-order"
                      className="select select-bordered bg-base-100"
                      value={sortOrder}
                      onChange={(event) =>
                        setSortOrder(event.target.value as 'asc' | 'desc')
                      }
                    >
                      <option value="desc">Desc</option>
                      <option value="asc">Asc</option>
                    </select>
                  </div>

                  <div className="flex flex-wrap items-end gap-2 lg:col-span-5">
                    <button type="button" className="btn btn-ghost" onClick={resetFilters}>
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Store Tracking Trend</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                      Select a store to display its CRM process as a separate trend chart.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline'
                        }`}
                      onClick={() => changeViewMode('list')}
                    >
                      List View
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${viewMode === 'tracking' ? 'btn-primary' : 'btn-outline'
                        }`}
                      onClick={() => changeViewMode('tracking')}
                    >
                      Tracking View
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-outline'
                        }`}
                      onClick={() => changeViewMode('calendar')}
                    >
                      Calendar View
                    </button>

                    <button
                      type="button"
                      className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-outline'
                        }`}
                      onClick={() => changeViewMode('board')}
                    >
                      Board View
                    </button>
                  </div>
                </div>

                {viewMode === 'tracking' && (
                  <>
                    <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                      <select
                        className="select select-bordered bg-base-100 md:col-span-2"
                        value={trackingStore?._id || ''}
                        onChange={(event) => {
                          const selected =
                            stores.find((item) => item._id === event.target.value) || null;

                          loadTrackingStore(selected);
                        }}
                      >
                        <option value="">Select a store to view tracking trend</option>
                        {stores.map((store) => (
                          <option key={store._id} value={store._id}>
                            {store.name} — {store.domain}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => loadTrackingStore(null)}
                      >
                        Clear Selected Store
                      </button>
                    </div>

                    {isTrackingLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <span className="loading loading-spinner loading-lg" />
                      </div>
                    ) : trackingStore ? (
                      <StoreTrackingTrend store={trackingStore} events={trackingEvents} />
                    ) : (
                      <div className="rounded-3xl border border-dashed border-base-300 bg-base-200/40 p-8 text-center">
                        <div className="text-4xl">📈</div>
                        <h3 className="mt-3 text-lg font-semibold">
                          Select a store to display its tracking trend
                        </h3>
                        <p className="mt-2 text-sm text-base-content/60">
                          The chart uses store timeline events. If no events exist, it falls back
                          to the current CRM state.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {viewMode === 'calendar' && (
                <CrmFunnelCalendar
                  q={search}
                  stage={stageFilter}
                  leadStatus={statusFilter}
                  storePriority={priorityFilter}
                  painAngle={painAngleFilter}
                  hasEmail={hasEmailFilter}
                  onOpenStore={openDetailsByStoreId}
                />
              )}

              {viewMode === 'board' && (
                <div className="rounded-3xl border border-base-300 bg-base-100">
                  <div className="flex flex-col gap-3 border-b border-base-300 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Funnel Board</h2>
                      <p className="mt-1 text-sm text-base-content/60">
                        Current page stores grouped by funnel stage.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="badge badge-outline">Page {pagination.page}</span>
                      <span className="badge badge-outline">Limit {pagination.limit}</span>
                      <span className="badge badge-outline">Total {pagination.totalDocs}</span>
                    </div>
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <span className="loading loading-spinner loading-lg" />
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="px-6 py-16 text-center">
                      <div className="mx-auto max-w-md">
                        <div className="text-4xl">🧭</div>
                        <h3 className="mt-3 text-lg font-semibold">
                          No stores in this funnel view
                        </h3>
                        <p className="mt-2 text-sm text-base-content/60">
                          Reset filters or go back to Stores to import or create stores.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto p-5">
                      <div className="flex min-w-max gap-4">
                        {visibleStages.map((stage) => {
                          const stageStores = boardStoresByStage[stage] || [];

                          return (
                            <div
                              key={stage}
                              className="w-[330px] shrink-0 rounded-3xl border border-base-300 bg-base-200/40"
                            >
                              <div className="rounded-t-3xl border-b border-base-300 bg-base-100 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold">{humanize(stage)}</div>
                                    <div className="mt-1 text-xs text-base-content/50">
                                      Total: {stageCounts[stage] || 0}
                                    </div>
                                  </div>

                                  <span
                                    className={`badge badge-outline ${getStageBadgeClass(stage)}`}
                                  >
                                    {stageStores.length}
                                  </span>
                                </div>
                              </div>

                              <div className="max-h-[640px] space-y-3 overflow-y-auto p-3">
                                {stageStores.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-4 text-sm text-base-content/50">
                                    No stores on this page.
                                  </div>
                                ) : (
                                  stageStores.map((store) => (
                                    <div
                                      key={store._id}
                                      className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <button
                                            type="button"
                                            className="link-hover link block truncate text-left font-semibold text-base-content"
                                            onClick={() => openDetailsModal(store)}
                                          >
                                            {store.name}
                                          </button>

                                          <div className="mt-1 truncate text-xs text-base-content/50">
                                            {store.domain}
                                          </div>
                                        </div>

                                        <span
                                          className={`badge badge-outline ${getPriorityBadgeClass(
                                            store.crm?.priority || 'medium'
                                          )}`}
                                        >
                                          {humanize(store.crm?.priority || 'medium')}
                                        </span>
                                      </div>

                                      <div className="mt-3 flex flex-wrap gap-1">
                                        <span
                                          className={`badge badge-outline ${getStatusBadgeClass(
                                            store.crm?.leadStatus || 'new'
                                          )}`}
                                        >
                                          {humanize(store.crm?.leadStatus || 'new')}
                                        </span>

                                        <span className="badge badge-ghost">
                                          Score {store.crm?.fitScore || 0}
                                        </span>
                                      </div>

                                      <div className="mt-3 space-y-1 text-xs text-base-content/60">
                                        <div>
                                          Email:{' '}
                                          <span className="font-medium text-base-content">
                                            {getPrimaryEmail(store) || '-'}
                                          </span>
                                        </div>

                                        <div>
                                          Pain:{' '}
                                          <span className="font-medium text-base-content">
                                            {humanize(store.crm?.painAngle || 'unknown')}
                                          </span>
                                        </div>

                                        <div>
                                          Next:{' '}
                                          <span className="font-medium text-base-content">
                                            {formatDateTime(store.crm?.nextFollowUpAt)}
                                          </span>
                                        </div>
                                      </div>

                                      <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-xs"
                                          onClick={() => openFunnelModal(store)}
                                        >
                                          Update
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-outline btn-xs"
                                          onClick={() => openTaskModal(store)}
                                        >
                                          Task
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-ghost btn-xs"
                                          onClick={() => openDetailsModal(store)}
                                        >
                                          Details
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-info btn-outline btn-xs"
                                          onClick={() => {
                                            changeViewMode('tracking');
                                            loadTrackingStore(store);
                                          }}
                                        >
                                          Trend
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewMode === 'list' && (
                <div className="rounded-3xl border border-base-300 bg-base-100">
                  <div className="flex flex-col gap-3 border-b border-base-300 p-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">Lead List</h2>
                      <p className="mt-1 text-sm text-base-content/60">
                        Same filtered stores in table view.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-auto">
                    <table className="table table-zebra table-pin-rows min-w-[1280px]">
                      <thead>
                        <tr className="bg-base-200">
                          <th>Store</th>
                          <th>Contact</th>
                          <th>Stage</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Score</th>
                          <th>Pain Angle</th>
                          <th>Next Follow-up</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {stores.map((store) => (
                          <tr key={store._id}>
                            <td>
                              <div className="font-semibold">{store.name}</div>
                              <a
                                href={`https://${store.domain}`}
                                target="_blank"
                                rel="noreferrer"
                                className="link-hover link text-xs"
                              >
                                {store.domain}
                              </a>
                            </td>

                            <td>
                              <div className="text-sm">{store.contactName || '-'}</div>
                              {getPrimaryEmail(store) ? (
                                <a
                                  href={`mailto:${getPrimaryEmail(store)}`}
                                  className="link-hover link break-all text-xs"
                                >
                                  {getPrimaryEmail(store)}
                                </a>
                              ) : (
                                <div className="text-xs text-base-content/50">No email</div>
                              )}
                            </td>

                            <td>
                              <span
                                className={`badge badge-outline ${getStageBadgeClass(
                                  store.crm?.funnelStage || 'discovered'
                                )}`}
                              >
                                {humanize(store.crm?.funnelStage || 'discovered')}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`badge badge-outline ${getStatusBadgeClass(
                                  store.crm?.leadStatus || 'new'
                                )}`}
                              >
                                {humanize(store.crm?.leadStatus || 'new')}
                              </span>
                            </td>

                            <td>
                              <span
                                className={`badge badge-outline ${getPriorityBadgeClass(
                                  store.crm?.priority || 'medium'
                                )}`}
                              >
                                {humanize(store.crm?.priority || 'medium')}
                              </span>
                            </td>

                            <td>{store.crm?.fitScore || 0}</td>
                            <td>{humanize(store.crm?.painAngle || 'unknown')}</td>
                            <td>{formatDateTime(store.crm?.nextFollowUpAt)}</td>

                            <td className="text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-primary btn-outline btn-sm"
                                  onClick={() => openFunnelModal(store)}
                                >
                                  Update
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-secondary btn-outline btn-sm"
                                  onClick={() => openTaskModal(store)}
                                >
                                  Task
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-info btn-outline btn-sm"
                                  onClick={() => {
                                    changeViewMode('tracking');
                                    loadTrackingStore(store);
                                  }}
                                >
                                  Trend
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => openDetailsModal(store)}
                                >
                                  Details
                                </button>

                                <Link
                                  href={`/dashboard/stores/${store._id}/crm`}
                                  className="btn btn-info btn-outline btn-sm"
                                >
                                  CRM
                                </Link>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-3 border-t border-base-300 p-5 md:flex-row md:items-center md:justify-between">
                    <div className="text-sm text-base-content/60">
                      Page {pagination.page} of {pagination.totalPages} ·{' '}
                      {pagination.totalDocs} stores
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        className="select select-bordered select-sm bg-base-100"
                        value={limit}
                        onChange={(event) => {
                          setLimit(Number(event.target.value));
                          setPage(1);
                        }}
                      >
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                      </select>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={!pagination.hasPrevPage}
                        onClick={() => setPage(Math.max(pagination.page - 1, 1))}
                      >
                        Previous
                      </button>

                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={!pagination.hasNextPage}
                        onClick={() => setPage(pagination.page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {modalMode && activeStore && (
            <dialog open className="modal">
              <div className="modal-box max-h-[90vh] max-w-5xl overflow-y-auto rounded-3xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-base-content">
                      {modalMode === 'funnel'
                        ? 'Update Funnel'
                        : modalMode === 'task'
                          ? 'Create CRM Task'
                          : 'Store CRM Details'}
                    </h3>

                    <p className="mt-1 text-sm text-base-content/70">
                      {activeStore.name} · {activeStore.domain}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-circle btn-ghost btn-sm"
                    onClick={closeModal}
                  >
                    ✕
                  </button>
                </div>

                {modalMode === 'funnel' && (
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-100">
                      <div className="border-b border-base-300 bg-gradient-to-r from-primary/10 via-base-100 to-base-100 p-5">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl">
                              🧭
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xl font-bold text-base-content">Update Funnel</h4>

                                <span className={`badge badge-outline ${getStageBadgeClass(funnelForm.funnelStage)}`}>
                                  {humanize(funnelForm.funnelStage)}
                                </span>

                                <span className={`badge badge-outline ${getStatusBadgeClass(funnelForm.leadStatus)}`}>
                                  {humanize(funnelForm.leadStatus)}
                                </span>
                              </div>

                              <p className="mt-1 max-w-2xl text-sm leading-6 text-base-content/60">
                                Update the store’s CRM position, qualification quality, next action,
                                and timeline note in one structured flow.
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-base-content/50">Store</div>

                            <div className="mt-1 font-semibold text-base-content">{activeStore.name}</div>

                            <div className="mt-1 break-all text-xs text-base-content/50">
                              {activeStore.domain}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[340px_1fr]">
                        <div className="border-b border-base-300 bg-base-200/30 p-5 xl:border-b-0 xl:border-r">
                          <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                            <div className="text-sm font-bold text-base-content">Current Store Context</div>

                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Current stage</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.funnelStage || 'discovered')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Current status</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.leadStatus || 'new')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Priority</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.priority || 'medium')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Fit score</div>
                                <div className="mt-1 font-semibold">{activeStore.crm?.fitScore || 0}</div>
                              </div>
                            </div>

                            <div className="mt-4 rounded-2xl bg-primary/10 p-3 text-xs leading-5 text-primary">
                              Use this modal only when the store has actually moved forward,
                              changed qualification, or needs a clear next follow-up.
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 p-4">
                            <div className="text-sm font-bold text-base-content">Next Follow-up</div>

                            <p className="mt-1 text-xs leading-5 text-base-content/50">
                              Set the next operational touchpoint for this store.
                            </p>

                            <input
                              type="datetime-local"
                              className="input input-bordered mt-3 h-12 w-full bg-base-100"
                              value={funnelForm.nextFollowUpAt}
                              onChange={(event) =>
                                setFunnelForm((current) => ({
                                  ...current,
                                  nextFollowUpAt: event.target.value,
                                }))
                              }
                            />

                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    nextFollowUpAt: getSuggestedDueAt(1, 9, 0),
                                  }))
                                }
                              >
                                Tomorrow 09:00
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    nextFollowUpAt: getSuggestedDueAt(3, 9, 0),
                                  }))
                                }
                              >
                                In 3 days
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline btn-xs"
                                onClick={() =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    nextFollowUpAt: getSuggestedDueAt(7, 9, 0),
                                  }))
                                }
                              >
                                Next week
                              </button>

                              {funnelForm.nextFollowUpAt && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setFunnelForm((current) => ({
                                      ...current,
                                      nextFollowUpAt: '',
                                    }))
                                  }
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            {funnelForm.nextFollowUpAt && (
                              <div className="mt-3 rounded-xl bg-base-200/70 px-3 py-2 text-xs text-base-content/60">
                                Selected: <span className="font-semibold">{formatDateTime(funnelForm.nextFollowUpAt)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-5 p-5">
                          <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                            <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-semibold">Funnel Stage</div>
                                <div className="text-xs text-base-content/50">
                                  Select the main CRM position. Keep this lean and milestone-based.
                                </div>
                              </div>

                              <span className={`badge badge-outline ${getStageBadgeClass(funnelForm.funnelStage)}`}>
                                {humanize(funnelForm.funnelStage)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                              {meta.stages.map((stage) => {
                                const active = funnelForm.funnelStage === stage;

                                return (
                                  <button
                                    key={stage}
                                    type="button"
                                    className={`rounded-2xl border p-3 text-left transition ${active
                                        ? 'border-primary bg-primary text-primary-content shadow-md shadow-primary/20'
                                        : 'border-base-300 bg-base-200/40 hover:border-primary/40 hover:bg-base-200'
                                      }`}
                                    onClick={() =>
                                      setFunnelForm((current) => ({
                                        ...current,
                                        funnelStage: stage,
                                        eventType:
                                          stage === 'won'
                                            ? 'won'
                                            : stage === 'lost'
                                              ? 'lost'
                                              : stage === 'activated'
                                                ? 'activated'
                                                : 'stage_changed',
                                      }))
                                    }
                                  >
                                    <div className="text-sm font-bold">{humanize(stage)}</div>

                                    <div className="mt-1 text-[11px] opacity-70">
                                      {stage === 'discovered' && 'Store exists'}
                                      {stage === 'qualified' && 'Worth outreach'}
                                      {stage === 'contacted' && 'Outreach sent'}
                                      {stage === 'engaged' && 'Merchant replied'}
                                      {stage === 'installed' && 'App installed'}
                                      {stage === 'activated' && 'Used product value'}
                                      {stage === 'won' && 'Success'}
                                      {stage === 'lost' && 'Closed lost'}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4 xl:col-span-7">
                              <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                <div>
                                  <div className="font-semibold">Lead Status</div>
                                  <div className="text-xs text-base-content/50">
                                    More specific than stage. Use it for outreach/reply/install details.
                                  </div>
                                </div>

                                <span className={`badge badge-outline ${getStatusBadgeClass(funnelForm.leadStatus)}`}>
                                  {humanize(funnelForm.leadStatus)}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                {meta.statuses.map((status) => {
                                  const active = funnelForm.leadStatus === status;

                                  return (
                                    <button
                                      key={status}
                                      type="button"
                                      className={`btn btn-sm justify-start ${active ? 'btn-primary' : 'btn-outline'
                                        }`}
                                      onClick={() =>
                                        setFunnelForm((current) => ({
                                          ...current,
                                          leadStatus: status,
                                        }))
                                      }
                                    >
                                      {humanize(status)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-4 xl:col-span-5">
                              <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold">Priority</div>
                                    <div className="text-xs text-base-content/50">Operational importance.</div>
                                  </div>

                                  <span className={`badge badge-outline ${getPriorityBadgeClass(funnelForm.priority)}`}>
                                    {humanize(funnelForm.priority)}
                                  </span>
                                </div>

                                <div className="grid grid-cols-3 gap-2 rounded-2xl border border-base-300 bg-base-200/40 p-1.5">
                                  {meta.priorities.map((priority) => {
                                    const active = funnelForm.priority === priority;

                                    return (
                                      <button
                                        key={priority}
                                        type="button"
                                        className={`btn btn-sm min-h-9 ${active
                                            ? priority === 'high'
                                              ? 'btn-error'
                                              : priority === 'low'
                                                ? 'btn-ghost bg-base-100'
                                                : 'btn-warning'
                                            : 'btn-ghost'
                                          }`}
                                        onClick={() =>
                                          setFunnelForm((current) => ({
                                            ...current,
                                            priority,
                                          }))
                                        }
                                      >
                                        {humanize(priority)}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                <div className="mb-3 flex items-center justify-between gap-3">
                                  <div>
                                    <div className="font-semibold">Fit Score</div>
                                    <div className="text-xs text-base-content/50">0 to 100 qualification score.</div>
                                  </div>

                                  <span className="rounded-2xl bg-primary/10 px-3 py-1 text-lg font-black text-primary">
                                    {funnelForm.fitScore}
                                  </span>
                                </div>

                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  value={funnelForm.fitScore}
                                  className="range range-primary range-sm"
                                  onChange={(event) =>
                                    setFunnelForm((current) => ({
                                      ...current,
                                      fitScore: Number(event.target.value),
                                    }))
                                  }
                                />

                                <div className="mt-2 flex justify-between text-[11px] text-base-content/40">
                                  <span>Low</span>
                                  <span>Medium</span>
                                  <span>High</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                              <label className="label px-0 pt-0">
                                <span className="label-text font-semibold">Pain Angle</span>
                              </label>

                              <select
                                className="select select-bordered h-12 w-full bg-base-100"
                                value={funnelForm.painAngle}
                                onChange={(event) =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    painAngle: event.target.value,
                                  }))
                                }
                              >
                                {meta.painAngles.map((angle) => (
                                  <option key={angle} value={angle}>
                                    {humanize(angle)}
                                  </option>
                                ))}
                              </select>

                              <div className="mt-2 text-xs text-base-content/50">
                                Used for message positioning and outreach context.
                              </div>
                            </div>

                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                              <label className="label px-0 pt-0">
                                <span className="label-text font-semibold">Timeline Event</span>
                              </label>

                              <select
                                className="select select-bordered h-12 w-full bg-base-100"
                                value={funnelForm.eventType}
                                onChange={(event) =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    eventType: event.target.value,
                                  }))
                                }
                              >
                                {meta.eventTypes.map((eventType) => (
                                  <option key={eventType} value={eventType}>
                                    {humanize(eventType)}
                                  </option>
                                ))}
                              </select>

                              <div className="mt-2 text-xs text-base-content/50">
                                This creates the timeline record for the CRM history.
                              </div>
                            </div>
                          </div>

                          {(funnelForm.funnelStage === 'lost' || funnelForm.leadStatus === 'lost') && (
                            <div className="rounded-2xl border border-error/30 bg-error/10 p-4">
                              <label className="label px-0 pt-0">
                                <span className="label-text font-semibold text-error">Lost Reason</span>
                              </label>

                              <input
                                className="input input-bordered h-12 w-full bg-base-100"
                                value={funnelForm.lostReason}
                                onChange={(event) =>
                                  setFunnelForm((current) => ({
                                    ...current,
                                    lostReason: event.target.value,
                                  }))
                                }
                                placeholder="Example: Not interested, no fit, bounced email, competitor, price concern"
                              />
                            </div>
                          )}

                          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                            <div className="border-b border-base-300 bg-base-200/40 p-4">
                              <div className="font-semibold">CRM Notes</div>
                              <div className="mt-1 text-xs text-base-content/50">
                                Internal note for the store profile. Keep it useful for the next operator.
                              </div>
                            </div>

                            <textarea
                              className="min-h-[120px] w-full resize-none bg-base-100 p-4 text-sm leading-7 outline-none placeholder:text-base-content/35"
                              value={funnelForm.notes}
                              onChange={(event) =>
                                setFunnelForm((current) => ({
                                  ...current,
                                  notes: event.target.value,
                                }))
                              }
                              placeholder="Example: Store has analytics pain. Owner asked about weekly product performance reporting."
                            />

                            <div className="flex items-center justify-between border-t border-base-300 bg-base-200/30 px-4 py-2 text-xs text-base-content/50">
                              <span>Internal CRM note</span>
                              <span>{funnelForm.notes.length} characters</span>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                            <div className="border-b border-base-300 bg-base-200/40 p-4">
                              <div className="font-semibold">Event Description</div>
                              <div className="mt-1 text-xs text-base-content/50">
                                What changed in this update? This appears in the timeline.
                              </div>
                            </div>

                            <textarea
                              className="min-h-[96px] w-full resize-none bg-base-100 p-4 text-sm leading-7 outline-none placeholder:text-base-content/35"
                              value={funnelForm.eventDescription}
                              onChange={(event) =>
                                setFunnelForm((current) => ({
                                  ...current,
                                  eventDescription: event.target.value,
                                }))
                              }
                              placeholder="Example: Merchant replied positively and asked for the install link."
                            />

                            <div className="flex items-center justify-between border-t border-base-300 bg-base-200/30 px-4 py-2 text-xs text-base-content/50">
                              <span>Timeline event note</span>
                              <span>{funnelForm.eventDescription.length} characters</span>
                            </div>
                          </div>

                          <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-base-300 bg-base-100/95 p-5 backdrop-blur">
                            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <div className="text-sm text-base-content/60">
                                Updating{' '}
                                <span className="font-semibold text-base-content">{activeStore.name}</span>
                                {' '}to{' '}
                                <span className="font-semibold text-base-content">
                                  {humanize(funnelForm.funnelStage)}
                                </span>
                                {' '}·{' '}
                                <span className="font-semibold text-base-content">
                                  {humanize(funnelForm.leadStatus)}
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button type="button" className="btn btn-ghost" onClick={closeModal}>
                                  Cancel
                                </button>

                                <button
                                  type="button"
                                  className={`btn btn-primary min-w-[150px] ${isSavingFunnel ? 'btn-disabled' : ''
                                    }`}
                                  onClick={submitFunnelUpdate}
                                >
                                  {isSavingFunnel ? (
                                    <>
                                      <span className="loading loading-spinner loading-sm" />
                                      Saving
                                    </>
                                  ) : (
                                    'Save Funnel'
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {modalMode === 'task' && (
                  <div className="space-y-6">
                    <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-100">
                      <div className="border-b border-base-300 bg-gradient-to-r from-primary/10 via-base-100 to-base-100 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-start gap-4">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-2xl">
                              ✅
                            </div>

                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-xl font-bold text-base-content">
                                  Create CRM Task
                                </h4>

                                <span className="badge badge-primary badge-outline">
                                  New action
                                </span>
                              </div>

                              <p className="mt-1 max-w-2xl text-sm leading-6 text-base-content/60">
                                Create the next operational step for this store. Keep it specific:
                                what should happen, when, and why.
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3">
                            <div className="text-xs uppercase tracking-wide text-base-content/50">
                              Store
                            </div>

                            <div className="mt-1 font-semibold text-base-content">
                              {activeStore.name}
                            </div>

                            <div className="mt-1 break-all text-xs text-base-content/50">
                              {activeStore.domain}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-0 xl:grid-cols-[360px_1fr]">
                        <div className="border-b border-base-300 bg-base-200/30 p-5 xl:border-b-0 xl:border-r">
                          <div>
                            <div className="text-sm font-bold text-base-content">
                              Quick Task Type
                            </div>

                            <p className="mt-1 text-xs leading-5 text-base-content/50">
                              Pick a common CRM action. It will prefill title, type, and context.
                            </p>
                          </div>

                          <div className="mt-4 space-y-2">
                            {taskTemplateOptions.map((template) => {
                              const isActive =
                                taskForm.type === template.type &&
                                taskForm.title === template.title;

                              return (
                                <button
                                  key={template.label}
                                  type="button"
                                  className={`w-full rounded-2xl border p-4 text-left transition ${isActive
                                    ? 'border-primary bg-primary/10'
                                    : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-100'
                                    }`}
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      title: template.title,
                                      type: template.type,
                                      description: current.description || template.description,
                                    }))
                                  }
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="font-semibold text-base-content">
                                        {template.label}
                                      </div>

                                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-base-content/50">
                                        {template.description}
                                      </div>
                                    </div>

                                    {isActive && (
                                      <span className="badge badge-primary badge-sm">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          <div className="mt-5 rounded-2xl border border-base-300 bg-base-100 p-4">
                            <div className="text-sm font-bold text-base-content">
                              Store Context
                            </div>

                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Stage</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.funnelStage || 'discovered')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Status</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.leadStatus || 'new')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Priority</div>
                                <div className="mt-1 font-semibold">
                                  {humanize(activeStore.crm?.priority || 'medium')}
                                </div>
                              </div>

                              <div className="rounded-xl bg-base-200/70 p-3">
                                <div className="text-base-content/50">Score</div>
                                <div className="mt-1 font-semibold">
                                  {activeStore.crm?.fitScore || 0}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-5 p-5">
                          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
                            <div className="form-control xl:col-span-8">
                              <label className="label">
                                <span className="label-text font-semibold">Task title</span>
                                <span className="label-text-alt text-error">Required</span>
                              </label>

                              <input
                                className="input input-bordered h-12 bg-base-100 text-base"
                                value={taskForm.title}
                                onChange={(event) =>
                                  setTaskForm((current) => ({
                                    ...current,
                                    title: event.target.value,
                                  }))
                                }
                                placeholder="Example: Follow up after first outreach"
                              />
                            </div>

                            <div className="form-control xl:col-span-4">
                              <label className="label">
                                <span className="label-text font-semibold">Due date & time</span>
                              </label>

                              <input
                                type="datetime-local"
                                className="input input-bordered h-12 bg-base-100"
                                value={taskForm.dueAt}
                                onChange={(event) =>
                                  setTaskForm((current) => ({
                                    ...current,
                                    dueAt: event.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <div className="rounded-2xl border border-base-300 bg-base-200/30 p-4">
                            <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-semibold">Quick schedule</div>
                                <div className="text-xs text-base-content/50">
                                  Use a suggested follow-up time or choose manually.
                                </div>
                              </div>

                              {taskForm.dueAt && (
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      dueAt: '',
                                    }))
                                  }
                                >
                                  Clear due date
                                </button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {quickDueOptions.map((option) => (
                                <button
                                  key={option.label}
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      dueAt: getSuggestedDueAt(
                                        option.days,
                                        option.hour,
                                        option.minute
                                      ),
                                    }))
                                  }
                                >
                                  {option.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="form-control">
                              <label className="label">
                                <span className="label-text font-semibold">Task type</span>
                              </label>

                              <select
                                className="select select-bordered h-12 bg-base-100"
                                value={taskForm.type}
                                onChange={(event) =>
                                  setTaskForm((current) => ({
                                    ...current,
                                    type: event.target.value,
                                  }))
                                }
                              >
                                {meta.taskTypes.map((taskType) => (
                                  <option key={taskType} value={taskType}>
                                    {humanize(taskType)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="form-control">
                              <label className="label">
                                <span className="label-text font-semibold">Priority</span>
                              </label>

                              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-base-300 bg-base-200/40 p-1.5">
                                {meta.taskPriorities.map((priority) => {
                                  const active = taskForm.priority === priority;

                                  return (
                                    <button
                                      key={priority}
                                      type="button"
                                      className={`btn btn-sm min-h-9 ${active
                                        ? priority === 'high'
                                          ? 'btn-error'
                                          : priority === 'low'
                                            ? 'btn-ghost bg-base-100'
                                            : 'btn-warning'
                                        : 'btn-ghost'
                                        }`}
                                      onClick={() =>
                                        setTaskForm((current) => ({
                                          ...current,
                                          priority,
                                        }))
                                      }
                                    >
                                      {humanize(priority)}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                            <div className="flex flex-col gap-3 border-b border-base-300 bg-base-200/40 p-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <div className="font-semibold">Task context</div>
                                <div className="mt-1 text-xs text-base-content/50">
                                  Add the reason, next action, or merchant conversation note.
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      description: current.description
                                        ? `${current.description}\nFollow up because there was no reply.`
                                        : 'Follow up because there was no reply.',
                                    }))
                                  }
                                >
                                  No reply
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      description: current.description
                                        ? `${current.description}\nSend the install link and explain the next step.`
                                        : 'Send the install link and explain the next step.',
                                    }))
                                  }
                                >
                                  Install link
                                </button>

                                <button
                                  type="button"
                                  className="btn btn-ghost btn-xs"
                                  onClick={() =>
                                    setTaskForm((current) => ({
                                      ...current,
                                      description: current.description
                                        ? `${current.description}\nMerchant showed interest. Continue the conversation.`
                                        : 'Merchant showed interest. Continue the conversation.',
                                    }))
                                  }
                                >
                                  Interested
                                </button>
                              </div>
                            </div>

                            <textarea
                              className="min-h-[140px] w-full resize-none bg-base-100 p-4 text-sm leading-7 outline-none placeholder:text-base-content/35"
                              value={taskForm.description}
                              onChange={(event) =>
                                setTaskForm((current) => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              placeholder="Example: Merchant asked about analytics reports. Next step: send install link and follow up tomorrow."
                            />

                            <div className="flex items-center justify-between border-t border-base-300 bg-base-200/30 px-4 py-2 text-xs text-base-content/50">
                              <span>Internal CRM note</span>
                              <span>{taskForm.description.length} characters</span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-200/40 p-4 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-base-content/60">
                              <span>Creating task for </span>
                              <span className="font-semibold text-base-content">
                                {activeStore.name}
                              </span>

                              {taskForm.dueAt && (
                                <>
                                  <span> · Due </span>
                                  <span className="font-semibold text-base-content">
                                    {formatDateTime(taskForm.dueAt)}
                                  </span>
                                </>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() =>
                                  setTaskForm({
                                    ...initialTaskForm,
                                    priority: activeStore.crm?.priority || 'medium',
                                  })
                                }
                              >
                                Reset
                              </button>

                              <button
                                type="button"
                                className="btn btn-outline"
                                onClick={closeModal}
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                className={`btn btn-primary min-w-[150px] ${isSavingTask ? 'btn-disabled' : ''
                                  }`}
                                onClick={submitTask}
                              >
                                {isSavingTask ? (
                                  <>
                                    <span className="loading loading-spinner loading-sm" />
                                    Creating
                                  </>
                                ) : (
                                  'Create Task'
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {modalMode === 'details' && (
                  <div>
                    {isDetailsLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <span className="loading loading-spinner loading-lg" />
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <StoreTrackingTrend store={activeStore} events={events} compact />

                        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                          <div className="space-y-5">
                            <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
                              <h4 className="mb-4 font-semibold">Store Summary</h4>

                              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <div className="rounded-2xl bg-base-200/60 p-4">
                                  <div className="text-xs text-base-content/50">Contact</div>
                                  <div className="mt-1 font-semibold">
                                    {activeStore.contactName || '-'}
                                  </div>
                                  <div className="mt-1 break-all text-sm text-base-content/60">
                                    {getPrimaryEmail(activeStore) || '-'}
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-base-200/60 p-4">
                                  <div className="text-xs text-base-content/50">Country</div>
                                  <div className="mt-1 font-semibold">
                                    {activeStore.country || '-'}
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-base-200/60 p-4">
                                  <div className="text-xs text-base-content/50">Fit Score</div>
                                  <div className="mt-1 text-xl font-bold">
                                    {activeStore.crm?.fitScore || 0}
                                  </div>
                                </div>

                                <div className="rounded-2xl bg-base-200/60 p-4">
                                  <div className="text-xs text-base-content/50">
                                    Next Follow-up
                                  </div>
                                  <div className="mt-1 font-semibold">
                                    {formatDateTime(activeStore.crm?.nextFollowUpAt)}
                                  </div>
                                </div>
                              </div>

                              {activeStore.crm?.notes && (
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-base-content/70">
                                  {activeStore.crm.notes}
                                </p>
                              )}
                            </div>

                            <div className="rounded-2xl border border-base-300 bg-base-100">
                              <div className="border-b border-base-300 p-4">
                                <h4 className="font-semibold">Tasks</h4>
                              </div>

                              <div className="max-h-[520px] space-y-3 overflow-auto p-4">
                                {tasks.length === 0 ? (
                                  <div className="text-sm text-base-content/50">
                                    No tasks yet.
                                  </div>
                                ) : (
                                  tasks.map((task) => (
                                    <div
                                      key={task._id}
                                      className="rounded-2xl border border-base-300 bg-base-200/40 p-4"
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="badge badge-outline">
                                          {humanize(task.status)}
                                        </span>
                                        <span
                                          className={`badge badge-outline ${getPriorityBadgeClass(
                                            task.priority
                                          )}`}
                                        >
                                          {humanize(task.priority)}
                                        </span>
                                        <span className="badge badge-ghost">
                                          {humanize(task.type)}
                                        </span>
                                      </div>

                                      <div className="mt-3 font-semibold">{task.title}</div>

                                      {task.description && (
                                        <p className="mt-1 text-sm text-base-content/70">
                                          {task.description}
                                        </p>
                                      )}

                                      <div className="mt-2 text-xs text-base-content/50">
                                        Due: {formatDateTime(task.dueAt)}
                                      </div>

                                      {task.status !== 'completed' &&
                                        task.status !== 'cancelled' && (
                                          <div className="mt-3">
                                            <button
                                              type="button"
                                              className={`btn btn-success btn-outline btn-xs ${actingTaskId === task._id ? 'btn-disabled' : ''
                                                }`}
                                              onClick={() => completeTask(task)}
                                            >
                                              {actingTaskId === task._id ? 'Working...' : 'Complete'}
                                            </button>
                                          </div>
                                        )}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-base-300 bg-base-100">
                            <div className="border-b border-base-300 p-4">
                              <h4 className="font-semibold">Timeline</h4>
                            </div>

                            <div className="max-h-[720px] space-y-3 overflow-auto p-4">
                              {events.length === 0 ? (
                                <div className="text-sm text-base-content/50">
                                  No timeline events yet.
                                </div>
                              ) : (
                                events.map((event) => (
                                  <div
                                    key={event._id}
                                    className="rounded-2xl border border-base-300 bg-base-200/40 p-4"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="badge badge-primary badge-outline">
                                        {humanize(event.type)}
                                      </span>

                                      {event.channel && (
                                        <span className="badge badge-ghost">
                                          {humanize(event.channel)}
                                        </span>
                                      )}

                                      <span className="text-xs text-base-content/50">
                                        {formatDateTime(event.createdAt)}
                                      </span>
                                    </div>

                                    <div className="mt-3 font-semibold">
                                      {event.title || humanize(event.type)}
                                    </div>

                                    {event.description && (
                                      <p className="mt-1 text-sm leading-6 text-base-content/70">
                                        {event.description}
                                      </p>
                                    )}

                                    <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-base-content/50 md:grid-cols-2">
                                      <div>
                                        Stage: {humanize(event.previousStage)} →{' '}
                                        {humanize(event.nextStage)}
                                      </div>
                                      <div>
                                        Status: {humanize(event.previousStatus)} →{' '}
                                        {humanize(event.nextStatus)}
                                      </div>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form method="dialog" className="modal-backdrop">
                <button type="button" onClick={closeModal}>
                  close
                </button>
              </form>
            </dialog>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();

export default dynamic(() => Promise.resolve(CrmFunnelPage), {
  ssr: false,
});