import api from '@/lib/axios';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import { format, getDay, parse, startOfWeek } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { toast } from 'sonner';

type CalendarItemKind = 'task' | 'follow_up' | 'event';

type CrmCalendarItem = {
  id: string;
  kind: CalendarItemKind;
  taskId?: string;
  eventId?: string;
  storeId: string;
  storeName: string;
  storeDomain: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  type?: string;
  status?: string;
  priority?: string;
  funnelStage?: string;
  leadStatus?: string;
  channel?: string;
  isOverdue?: boolean;
};

type CalendarSummary = {
  totalItems: number;
  totalTasks: number;
  totalFollowUps: number;
  totalEvents: number;
  overdueTasks: number;
  completedTasks: number;
};

type BigCalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: CrmCalendarItem;
};

type SelectedDay = {
  date: Date;
  items: CrmCalendarItem[];
};

type StoreOption = {
  _id: string;
  name: string;
  domain: string;
};

type TaskFormMode = 'create' | 'edit';

type TaskForm = {
  taskId: string;
  storeId: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  dueDate: string;
  dueTime: string;
};

type Props = {
  q?: string;
  stage?: string;
  leadStatus?: string;
  storePriority?: string;
  painAngle?: string;
  hasEmail?: string;
  onOpenStore?: (storeId: string) => void;
};

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const emptySummary: CalendarSummary = {
  totalItems: 0,
  totalTasks: 0,
  totalFollowUps: 0,
  totalEvents: 0,
  overdueTasks: 0,
  completedTasks: 0,
};

const taskTypes = [
  'follow_up',
  'send_email',
  'send_install_link',
  'book_demo',
  'onboarding_follow_up',
  'manual_review',
  'other',
];

const taskPriorities = ['low', 'medium', 'high'];

const taskStatuses = ['open', 'in_progress', 'completed', 'cancelled'];

const quickContextOptions = [
  {
    label: 'No reply',
    value: 'Follow up because there was no reply.',
  },
  {
    label: 'Install link',
    value: 'Send install link and explain the next step.',
  },
  {
    label: 'Interested',
    value: 'Merchant showed interest. Continue the conversation.',
  },
  {
    label: 'Demo',
    value: 'Prepare demo or answer product questions.',
  },
];

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

function isSameLocalDay(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1, 0, 0, 0);

  return { start, end };
}

function ensureEventEnd(start: Date, rawEnd?: string) {
  const end = rawEnd ? new Date(rawEnd) : new Date(start);

  if (Number.isNaN(end.getTime()) || end <= start) {
    const fallbackEnd = new Date(start);
    fallbackEnd.setMinutes(fallbackEnd.getMinutes() + 45);
    return fallbackEnd;
  }

  return end;
}

function toBigCalendarEvents(items: CrmCalendarItem[]): BigCalendarEvent[] {
  return items
    .map((item) => {
      const start = new Date(item.start);

      if (Number.isNaN(start.getTime())) return null;

      const storeLabel = item.storeName || item.storeDomain || 'Unknown store';
      const kindLabel = humanize(item.kind);

      return {
        id: item.id,
        title: `${kindLabel}: ${item.title} · ${storeLabel}`,
        start,
        end: ensureEventEnd(start, item.end),
        resource: item,
      };
    })
    .filter(Boolean) as BigCalendarEvent[];
}

function formatDayTitle(date: Date) {
  return date.toLocaleDateString([], {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toDateInput(value?: string | Date | null) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(value?: string | Date | null) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const pad = (input: number) => String(input).padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildIsoDateTimeFromParts(dateValue: string, timeValue: string) {
  if (!dateValue) return null;

  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour = 9, minute = 0] = (timeValue || '09:00').split(':').map(Number);

  if (!year || !month || !day) return null;

  const localDate = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (Number.isNaN(localDate.getTime())) return null;

  return localDate.toISOString();
}

function createInitialTaskForm(day?: Date): TaskForm {
  const baseDate = day ? new Date(day) : new Date();

  baseDate.setHours(9, 0, 0, 0);

  return {
    taskId: '',
    storeId: '',
    title: '',
    description: '',
    type: 'follow_up',
    priority: 'medium',
    status: 'open',
    dueDate: day ? toDateInput(baseDate) : '',
    dueTime: '09:00',
  };
}

function getKindBadgeClass(kind: CalendarItemKind) {
  if (kind === 'task') return 'badge-primary';
  if (kind === 'follow_up') return 'badge-warning';

  return 'badge-info';
}

function getPriorityBadgeClass(priority?: string) {
  if (priority === 'high') return 'badge-error';
  if (priority === 'low') return 'badge-ghost';

  return 'badge-warning';
}

function getStatusBadgeClass(status?: string) {
  if (status === 'completed') return 'badge-success';
  if (status === 'cancelled') return 'badge-ghost';
  if (status === 'in_progress') return 'badge-info';
  if (status === 'open') return 'badge-primary';

  return 'badge-outline';
}

function getEventClassName(event: BigCalendarEvent) {
  const item = event.resource;

  if (item.isOverdue) {
    return 'crm-calendar-event crm-calendar-event-overdue';
  }

  if (item.kind === 'task') {
    return 'crm-calendar-event crm-calendar-event-task';
  }

  if (item.kind === 'follow_up') {
    return 'crm-calendar-event crm-calendar-event-follow-up';
  }

  return 'crm-calendar-event crm-calendar-event-history';
}

function CalendarEvent({ event }: any) {
  const item = event.resource as CrmCalendarItem;

  return (
    <div className="leading-tight">
      <div className="truncate text-[11px] font-semibold">{item.title}</div>

      <div className="truncate text-[10px] opacity-80">
        {item.storeName || item.storeDomain || '-'}
      </div>
    </div>
  );
}

function CalendarToolbar(toolbar: any) {
  return (
    <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => toolbar.onNavigate('PREV')}
        >
          Previous
        </button>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => toolbar.onNavigate('TODAY')}
        >
          Today
        </button>

        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => toolbar.onNavigate('NEXT')}
        >
          Next
        </button>
      </div>

      <div className="rounded-2xl border border-primary/20 bg-primary/10 px-5 py-3 text-center">
        <div className="text-xs uppercase tracking-wide text-primary">Month</div>
        <div className="mt-1 text-xl font-bold text-base-content">{toolbar.label}</div>
      </div>

      <div className="badge badge-primary badge-outline">Month View Only</div>
    </div>
  );
}

function DayItemCard({
  item,
  onOpenStore,
  onEditTask,
  onCompleteTask,
  onDeleteTask,
  isActing,
}: {
  item: CrmCalendarItem;
  onOpenStore?: (storeId: string) => void;
  onEditTask?: (item: CrmCalendarItem) => void;
  onCompleteTask?: (item: CrmCalendarItem) => void;
  onDeleteTask?: (item: CrmCalendarItem) => void;
  isActing?: boolean;
}) {
  const isTask = item.kind === 'task' && Boolean(item.taskId);
  const canMarkDone = isTask && item.status !== 'completed' && item.status !== 'cancelled';

  return (
    <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`badge badge-outline ${getKindBadgeClass(item.kind)}`}>
          {humanize(item.kind)}
        </span>

        <span className={`badge badge-outline ${getPriorityBadgeClass(item.priority)}`}>
          {humanize(item.priority)}
        </span>

        <span className={`badge ${getStatusBadgeClass(item.status)}`}>
          {humanize(item.status)}
        </span>

        {item.isOverdue && <span className="badge badge-error">Overdue</span>}
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="font-semibold text-base-content">
          {formatTime(item.start)} · {item.title}
        </div>

        <div className="text-sm text-base-content/60">
          {item.storeName || item.storeDomain || '-'}
        </div>

        {item.description && (
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-base-content/70">
            {item.description}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onOpenStore && (
          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={() => onOpenStore(item.storeId)}
          >
            Details
          </button>
        )}

        <Link href={`/dashboard/stores/${item.storeId}/crm`} className="btn btn-outline btn-xs">
          CRM
        </Link>

        {item.storeDomain && (
          <a
            href={`https://${item.storeDomain}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-ghost btn-xs"
          >
            Store
          </a>
        )}

        {isTask && onEditTask && (
          <button
            type="button"
            className="btn btn-info btn-outline btn-xs"
            disabled={isActing}
            onClick={() => onEditTask(item)}
          >
            Edit
          </button>
        )}

        {canMarkDone && onCompleteTask && (
          <button
            type="button"
            className="btn btn-success btn-outline btn-xs"
            disabled={isActing}
            onClick={() => onCompleteTask(item)}
          >
            Done
          </button>
        )}

        {isTask && onDeleteTask && (
          <button
            type="button"
            className="btn btn-error btn-outline btn-xs"
            disabled={isActing}
            onClick={() => onDeleteTask(item)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

export default function CrmFunnelCalendar({
  q,
  stage,
  leadStatus,
  storePriority,
  painAngle,
  hasEmail,
  onOpenStore,
}: Props) {
  const [items, setItems] = useState<CrmCalendarItem[]>([]);
  const [summary, setSummary] = useState<CalendarSummary>(emptySummary);
  const [isLoading, setIsLoading] = useState(false);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [taskStatus, setTaskStatus] = useState('');
  const [date, setDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);

  const [storeOptions, setStoreOptions] = useState<StoreOption[]>([]);
  const [isStoreOptionsLoading, setIsStoreOptionsLoading] = useState(false);
  const [storeSearchDraft, setStoreSearchDraft] = useState('');
  const [storeSearch, setStoreSearch] = useState('');

  const [taskFormMode, setTaskFormMode] = useState<TaskFormMode>('create');
  const [taskForm, setTaskForm] = useState<TaskForm>(() => createInitialTaskForm());
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [actingTaskId, setActingTaskId] = useState('');

  const monthRange = useMemo(() => getMonthRange(date), [date]);

  const events = useMemo(() => toBigCalendarEvents(items), [items]);

  const mergedStoreOptions = useMemo(() => {
    const byId = new Map<string, StoreOption>();

    storeOptions.forEach((store) => {
      if (store._id) {
        byId.set(store._id, store);
      }
    });

    selectedDay?.items.forEach((item) => {
      if (item.storeId && !byId.has(item.storeId)) {
        byId.set(item.storeId, {
          _id: item.storeId,
          name: item.storeName || item.storeDomain || 'Unknown store',
          domain: item.storeDomain || '',
        });
      }
    });

    return Array.from(byId.values()).sort((a, b) => {
      return `${a.name} ${a.domain}`.localeCompare(`${b.name} ${b.domain}`);
    });
  }, [storeOptions, selectedDay]);

  const selectedStore = useMemo(() => {
    return mergedStoreOptions.find((store) => store._id === taskForm.storeId) || null;
  }, [mergedStoreOptions, taskForm.storeId]);

  const filteredStoreOptions = useMemo(() => {
    return mergedStoreOptions.slice(0, 20);
  }, [mergedStoreOptions]);

  const selectedDayTasks = useMemo(() => {
    if (!selectedDay) return [];

    return selectedDay.items.filter((item) => {
      if (item.kind === 'event') return false;
      if (item.status === 'completed') return false;

      return true;
    });
  }, [selectedDay]);

  const selectedDayWorkDone = useMemo(() => {
    if (!selectedDay) return [];

    return selectedDay.items.filter((item) => {
      if (item.kind === 'event') return true;
      if (item.status === 'completed') return true;

      return false;
    });
  }, [selectedDay]);

  const appendTaskContext = (text: string) => {
    setTaskForm((current) => {
      const cleanCurrent = current.description.trim();

      return {
        ...current,
        description: cleanCurrent ? `${cleanCurrent}\n${text}` : text,
      };
    });
  };

  const applyStoreFilter = async () => {
    const cleanSearch = storeSearchDraft.trim();

    setStoreSearch(cleanSearch);
    await loadStoreOptions(cleanSearch);
  };

  const clearStoreFilter = async () => {
    setStoreSearchDraft('');
    setStoreSearch('');
    await loadStoreOptions('');
  };

  const refreshSelectedDayFromItems = (dayDate: Date, nextItems: CrmCalendarItem[]) => {
    const dayItems = nextItems.filter((item) => {
      const itemDate = new Date(item.start);

      if (Number.isNaN(itemDate.getTime())) return false;

      return isSameLocalDay(itemDate, dayDate);
    });

    setSelectedDay({
      date: dayDate,
      items: dayItems,
    });
  };

  const loadCalendar = async () => {
    try {
      setIsLoading(true);

      const response = await api.get('/crm-funnel/calendar', {
        params: {
          start: monthRange.start.toISOString(),
          end: monthRange.end.toISOString(),
          includeEvents,
          ...(taskStatus ? { taskStatus } : {}),
          ...(q ? { q } : {}),
          ...(stage ? { stage } : {}),
          ...(leadStatus ? { leadStatus } : {}),
          ...(storePriority ? { storePriority } : {}),
          ...(painAngle ? { painAngle } : {}),
          ...(hasEmail ? { hasEmail } : {}),
        },
      });

      const nextItems = response?.data?.data?.items || [];

      setItems(nextItems);
      setSummary(response?.data?.data?.summary || emptySummary);

      return nextItems as CrmCalendarItem[];
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load CRM calendar.'));
      return [] as CrmCalendarItem[];
    } finally {
      setIsLoading(false);
    }
  };

  const loadStoreOptions = async (searchKeyword = '') => {
    try {
      setIsStoreOptionsLoading(true);

      const cleanSearch = searchKeyword.trim();

      const response = await api.get('/crm-funnel/stores', {
        params: {
          page: 1,
          limit: 50,
          ...(cleanSearch ? { q: cleanSearch } : {}),
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        },
      });

      const stores = response?.data?.data?.stores || [];

      setStoreOptions(
        stores.map((store: any) => ({
          _id: store._id,
          name: store.name || store.domain || 'Unknown store',
          domain: store.domain || '',
        }))
      );

      if (cleanSearch && stores.length === 0) {
        toast.message('No stores found for this filter.');
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load stores for task creation.'));
    } finally {
      setIsStoreOptionsLoading(false);
    }
  };

  const openDayModal = (dayDate: Date, sourceItems = items) => {
    const dayItems = sourceItems.filter((item) => {
      const itemDate = new Date(item.start);

      if (Number.isNaN(itemDate.getTime())) return false;

      return isSameLocalDay(itemDate, dayDate);
    });

    setSelectedDay({
      date: dayDate,
      items: dayItems,
    });

    setTaskFormMode('create');
    setTaskForm(createInitialTaskForm(dayDate));
    setStoreSearchDraft('');
    setStoreSearch('');
  };

  const resetCreateTaskForm = () => {
    setTaskFormMode('create');
    setTaskForm(createInitialTaskForm(selectedDay?.date));
    setStoreSearchDraft('');
    setStoreSearch('');
  };

  const startEditTask = (item: CrmCalendarItem) => {
    if (!item.taskId) {
      toast.error('This calendar item is not editable because it is not a CRM task.');
      return;
    }

    setTaskFormMode('edit');
    setStoreSearchDraft('');
    setStoreSearch('');
    setTaskForm({
      taskId: item.taskId,
      storeId: item.storeId || '',
      title: item.title || '',
      description: item.description || '',
      type: item.type || 'follow_up',
      priority: item.priority || 'medium',
      status: item.status || 'open',
      dueDate: toDateInput(item.start),
      dueTime: toTimeInput(item.start),
    });
  };

  const submitTaskForm = async () => {
    if (!selectedDay) return;

    if (!taskForm.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    if (!taskForm.dueDate) {
      toast.error('Task date is required.');
      return;
    }

    const dueAtIso = buildIsoDateTimeFromParts(taskForm.dueDate, taskForm.dueTime);

    if (!dueAtIso) {
      toast.error('Task date or time is invalid.');
      return;
    }

    if (taskFormMode === 'create' && !taskForm.storeId) {
      toast.error('Please select a store for this task.');
      return;
    }

    try {
      setIsSavingTask(true);

      const payload = {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        type: taskForm.type,
        priority: taskForm.priority,
        dueAt: dueAtIso,
        ...(taskFormMode === 'edit' ? { status: taskForm.status } : {}),
      };

      if (taskFormMode === 'edit') {
        if (!taskForm.taskId) {
          toast.error('Task ID is missing.');
          return;
        }

        await api.patch(`/crm-funnel/tasks/${taskForm.taskId}`, payload);
        toast.success('Task updated successfully.');
      } else {
        await api.post(`/crm-funnel/stores/${taskForm.storeId}/tasks`, payload);
        toast.success('Task created successfully.');
      }

      const nextItems = await loadCalendar();

      refreshSelectedDayFromItems(selectedDay.date, nextItems);
      resetCreateTaskForm();
    } catch (error: any) {
      toast.error(
        getErrorMessage(
          error,
          taskFormMode === 'edit' ? 'Failed to update task.' : 'Failed to create task.'
        )
      );
    } finally {
      setIsSavingTask(false);
    }
  };

  const completeTask = async (item: CrmCalendarItem) => {
    if (!selectedDay) return;

    if (!item.taskId) {
      toast.error('Task ID is missing.');
      return;
    }

    try {
      setActingTaskId(item.taskId);

      await api.patch(`/crm-funnel/tasks/${item.taskId}`, {
        status: 'completed',
      });

      toast.success('Task marked as done.');

      const nextItems = await loadCalendar();

      refreshSelectedDayFromItems(selectedDay.date, nextItems);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to complete task.'));
    } finally {
      setActingTaskId('');
    }
  };

  const deleteTask = async (item: CrmCalendarItem) => {
    if (!selectedDay) return;

    if (!item.taskId) {
      toast.error('Task ID is missing.');
      return;
    }

    try {
      setActingTaskId(item.taskId);

      await api.delete(`/crm-funnel/tasks/${item.taskId}`);

      toast.success('Task deleted.');

      const nextItems = await loadCalendar();

      refreshSelectedDayFromItems(selectedDay.date, nextItems);
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete task.'));
    } finally {
      setActingTaskId('');
    }
  };

  useEffect(() => {
    loadCalendar();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    monthRange.start.getTime(),
    monthRange.end.getTime(),
    includeEvents,
    taskStatus,
    q,
    stage,
    leadStatus,
    storePriority,
    painAngle,
    hasEmail,
  ]);

  useEffect(() => {
    if (!selectedDay) return;

    loadStoreOptions('');

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay?.date?.getTime()]);

  useEffect(() => {
    if (!selectedDay) return;
    if (taskFormMode !== 'create') return;
    if (taskForm.storeId) return;
    if (mergedStoreOptions.length === 0) return;

    setTaskForm((current) => ({
      ...current,
      storeId: mergedStoreOptions[0]._id,
    }));
  }, [mergedStoreOptions, selectedDay, taskForm.storeId, taskFormMode]);

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100">
      <style jsx global>{`
        .crm-big-calendar {
          width: 100%;
        }

        .crm-big-calendar .rbc-calendar {
          min-height: 760px;
          font-family: inherit;
        }

        .crm-big-calendar .rbc-month-view {
          border-radius: 1.5rem;
          overflow: hidden;
          border-color: hsl(var(--bc) / 0.12);
        }

        .crm-big-calendar .rbc-header {
          padding: 0.75rem 0.5rem;
          background: hsl(var(--b2) / 0.65);
          border-color: hsl(var(--bc) / 0.12);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--bc) / 0.65);
        }

        .crm-big-calendar .rbc-date-cell {
          padding: 0.35rem 0.5rem;
          font-size: 0.8rem;
          color: hsl(var(--bc) / 0.75);
        }

        .crm-big-calendar .rbc-date-cell a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 2rem;
          height: 2rem;
          border-radius: 999px;
          cursor: pointer;
          font-weight: 800;
          color: inherit;
        }

        .crm-big-calendar .rbc-date-cell a:hover {
          background: hsl(var(--p) / 0.12);
          color: hsl(var(--p));
        }

        .crm-big-calendar .rbc-off-range-bg {
          background: hsl(var(--b2) / 0.35);
        }

        .crm-big-calendar .rbc-today {
          background: hsl(var(--p) / 0.1);
          box-shadow: inset 0 0 0 2px hsl(var(--p) / 0.18);
        }

        .crm-big-calendar .rbc-today .rbc-date-cell a {
          background: hsl(var(--p));
          color: hsl(var(--pc));
        }

        .crm-big-calendar .rbc-day-bg {
          cursor: pointer;
        }

        .crm-big-calendar .rbc-day-bg:hover {
          background: hsl(var(--p) / 0.08);
        }

        .crm-big-calendar .rbc-event {
          border: 0;
          border-radius: 0.75rem;
          padding: 0.25rem 0.45rem;
          box-shadow: none;
          cursor: pointer;
        }

        .crm-calendar-event-task {
          background: hsl(var(--p));
          color: hsl(var(--pc));
        }

        .crm-calendar-event-follow-up {
          background: hsl(var(--wa));
          color: hsl(var(--wac));
        }

        .crm-calendar-event-history {
          background: hsl(var(--in));
          color: hsl(var(--inc));
        }

        .crm-calendar-event-overdue {
          background: hsl(var(--er));
          color: hsl(var(--erc));
        }
      `}</style>

      <div className="flex flex-col gap-4 border-b border-base-300 p-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold">CRM Calendar</h2>
          <p className="mt-1 text-sm text-base-content/60">
            Month view only. Click any day to create, edit, complete, or delete CRM tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="select select-bordered select-sm bg-base-100"
            value={taskStatus}
            onChange={(event) => setTaskStatus(event.target.value)}
          >
            <option value="">All task statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <label className="label cursor-pointer gap-2 rounded-xl border border-base-300 px-3 py-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={includeEvents}
              onChange={(event) => setIncludeEvents(event.target.checked)}
            />
            <span className="label-text text-xs">Show work done</span>
          </label>

          <button
            type="button"
            className={`btn btn-primary btn-sm ${isLoading ? 'btn-disabled' : ''}`}
            onClick={loadCalendar}
          >
            {isLoading ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Loading
              </>
            ) : (
              'Refresh'
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-base-300 p-5 md:grid-cols-6">
        <div className="rounded-2xl bg-base-200/60 p-4">
          <div className="text-xs uppercase tracking-wide text-base-content/50">Items</div>
          <div className="mt-1 text-xl font-bold">{summary.totalItems}</div>
        </div>

        <div className="rounded-2xl bg-primary/10 p-4">
          <div className="text-xs uppercase tracking-wide text-primary">Tasks</div>
          <div className="mt-1 text-xl font-bold">{summary.totalTasks}</div>
        </div>

        <div className="rounded-2xl bg-warning/10 p-4">
          <div className="text-xs uppercase tracking-wide text-warning">Follow-ups</div>
          <div className="mt-1 text-xl font-bold">{summary.totalFollowUps}</div>
        </div>

        <div className="rounded-2xl bg-info/10 p-4">
          <div className="text-xs uppercase tracking-wide text-info">Work Done</div>
          <div className="mt-1 text-xl font-bold">{summary.totalEvents}</div>
        </div>

        <div className="rounded-2xl bg-error/10 p-4">
          <div className="text-xs uppercase tracking-wide text-error">Overdue</div>
          <div className="mt-1 text-xl font-bold text-error">{summary.overdueTasks}</div>
        </div>

        <div className="rounded-2xl bg-success/10 p-4">
          <div className="text-xs uppercase tracking-wide text-success">Completed</div>
          <div className="mt-1 text-xl font-bold">{summary.completedTasks}</div>
        </div>
      </div>

      <div className="p-5">
        {isLoading && events.length === 0 ? (
          <div className="flex items-center justify-center rounded-3xl border border-base-300 bg-base-200/40 py-24">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : (
          <div className="crm-big-calendar">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              date={date}
              view={Views.MONTH}
              views={[Views.MONTH]}
              popup
              selectable="ignoreEvents"
              culture="en-US"
              onNavigate={(nextDate) => setDate(nextDate)}
              onSelectSlot={(slotInfo: any) => {
                const selectedDate = new Date(slotInfo.start);

                if (Number.isNaN(selectedDate.getTime())) return;

                openDayModal(selectedDate);
              }}
              onSelectEvent={(event) => {
                openDayModal(event.start);
              }}
              dayPropGetter={(dayDate) => {
                const today = new Date();

                if (isSameLocalDay(dayDate, today)) {
                  return {
                    className: 'crm-calendar-today-day',
                  };
                }

                return {};
              }}
              eventPropGetter={(event) => ({
                className: getEventClassName(event),
              })}
              components={{
                toolbar: CalendarToolbar,
                event: CalendarEvent,
              }}
              messages={{
                today: 'Today',
                previous: 'Previous',
                next: 'Next',
                month: 'Month',
                noEventsInRange: 'No CRM calendar items in this month.',
              }}
              style={{ height: 760 }}
            />
          </div>
        )}
      </div>

      {selectedDay && (
        <dialog open className="modal">
          <div className="modal-box max-h-[92vh] max-w-6xl overflow-y-auto rounded-3xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-base-content">
                  {formatDayTitle(selectedDay.date)}
                </h3>

                <p className="mt-1 text-sm text-base-content/60">
                  Create, edit, complete, or delete CRM tasks for this day.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-circle btn-ghost btn-sm"
                onClick={() => setSelectedDay(null)}
              >
                ✕
              </button>
            </div>

            <div className="mb-6 overflow-hidden rounded-3xl border border-base-300 bg-base-100 shadow-sm">
              <div className="border-b border-base-300 bg-base-200/40 p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        taskFormMode === 'edit'
                          ? 'bg-info/15 text-info'
                          : 'bg-primary/15 text-primary'
                      }`}
                    >
                      <span className="text-xl">{taskFormMode === 'edit' ? '✏️' : '➕'}</span>
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-lg font-bold">
                          {taskFormMode === 'edit' ? 'Edit Task' : 'Create Task'}
                        </h4>

                        <span
                          className={`badge badge-outline ${
                            taskFormMode === 'edit' ? 'badge-info' : 'badge-primary'
                          }`}
                        >
                          {taskFormMode === 'edit' ? 'Editing existing task' : 'New task'}
                        </span>
                      </div>

                      <p className="mt-1 max-w-2xl text-sm leading-6 text-base-content/60">
                        {taskFormMode === 'edit'
                          ? 'Update the task content, schedule, priority, and status. Store cannot be changed after creation.'
                          : 'Select a store, define the action, and schedule the next CRM step for this day.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {taskFormMode === 'edit' && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={resetCreateTaskForm}
                      >
                        Cancel Edit
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={resetCreateTaskForm}
                    >
                      Clear Form
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-0 xl:grid-cols-[minmax(320px,380px)_1fr]">
                <div className="border-b border-base-300 bg-base-200/20 p-5 xl:border-b-0 xl:border-r">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold">Store</div>
                      <div className="mt-1 text-xs text-base-content/50">
                        Choose where this task belongs.
                      </div>
                    </div>

                    {taskFormMode === 'edit' && <span className="badge badge-ghost">Locked</span>}
                  </div>

                  {selectedStore && (
                    <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/10 p-4">
                      <div className="text-xs uppercase tracking-wide text-primary">
                        Selected Store
                      </div>

                      <div className="mt-2 font-bold text-base-content">{selectedStore.name}</div>

                      <div className="mt-1 break-all text-sm text-base-content/60">
                        {selectedStore.domain || '-'}
                      </div>
                    </div>
                  )}

                  {taskFormMode === 'create' && (
                    <>
                      <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-base-content/50">
                          Search store
                        </label>

                        <div className="flex gap-2">
                          <input
                            className="input input-bordered input-sm min-w-0 flex-1 bg-base-100"
                            value={storeSearchDraft}
                            onChange={(event) => setStoreSearchDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                applyStoreFilter();
                              }
                            }}
                            placeholder="Type store name, domain, or email"
                          />

                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={applyStoreFilter}
                          >
                            Filter
                          </button>
                        </div>

                        {storeSearch && (
                          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs">
                            <span className="truncate text-primary">
                              Backend filter:{' '}
                              <span className="font-semibold">{storeSearch}</span>
                            </span>

                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={clearStoreFilter}
                            >
                              Clear
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto pr-1">
                        {isStoreOptionsLoading ? (
                          <div className="flex items-center justify-center rounded-2xl border border-base-300 bg-base-100 p-6">
                            <span className="loading loading-spinner loading-md" />
                          </div>
                        ) : filteredStoreOptions.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 p-5 text-center text-sm text-base-content/50">
                            No stores found. Try another filter.
                          </div>
                        ) : (
                          filteredStoreOptions.map((store) => {
                            const isSelected = taskForm.storeId === store._id;

                            return (
                              <button
                                key={store._id}
                                type="button"
                                className={`w-full rounded-2xl border p-3 text-left transition ${
                                  isSelected
                                    ? 'border-primary bg-primary/10'
                                    : 'border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200/60'
                                }`}
                                onClick={() =>
                                  setTaskForm((current) => ({
                                    ...current,
                                    storeId: store._id,
                                  }))
                                }
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold">
                                      {store.name}
                                    </div>

                                    <div className="mt-1 truncate text-xs text-base-content/50">
                                      {store.domain || '-'}
                                    </div>
                                  </div>

                                  {isSelected && (
                                    <span className="badge badge-primary badge-sm">Selected</span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                  {taskFormMode === 'edit' && !selectedStore && (
                    <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning-content">
                      Store information is not available for this task.
                    </div>
                  )}
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

                    <div className="xl:col-span-4">
                      <label className="label">
                        <span className="label-text font-semibold">Schedule</span>
                        <span className="label-text-alt text-error">Required</span>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/50">
                            Date
                          </div>

                          <input
                            type="date"
                            className="w-full bg-transparent text-sm font-semibold outline-none"
                            value={taskForm.dueDate}
                            onChange={(event) =>
                              setTaskForm((current) => ({
                                ...current,
                                dueDate: event.target.value,
                              }))
                            }
                          />
                        </div>

                        <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
                          <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-base-content/50">
                            Time
                          </div>

                          <input
                            type="time"
                            className="w-full bg-transparent text-sm font-semibold outline-none"
                            value={taskForm.dueTime}
                            onChange={(event) =>
                              setTaskForm((current) => ({
                                ...current,
                                dueTime: event.target.value,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                        {taskTypes.map((type) => (
                          <option key={type} value={type}>
                            {humanize(type)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Priority</span>
                      </label>

                      <div className="grid grid-cols-3 gap-2 rounded-2xl border border-base-300 bg-base-200/40 p-1.5">
                        {taskPriorities.map((priority) => {
                          const active = taskForm.priority === priority;

                          return (
                            <button
                              key={priority}
                              type="button"
                              className={`btn btn-sm min-h-9 ${
                                active
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

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text font-semibold">Status</span>
                      </label>

                      <select
                        className="select select-bordered h-12 bg-base-100"
                        value={taskForm.status}
                        disabled={taskFormMode === 'create'}
                        onChange={(event) =>
                          setTaskForm((current) => ({
                            ...current,
                            status: event.target.value,
                          }))
                        }
                      >
                        {taskStatuses.map((status) => (
                          <option key={status} value={status}>
                            {humanize(status)}
                          </option>
                        ))}
                      </select>

                      {taskFormMode === 'create' && (
                        <div className="mt-1 text-xs text-base-content/50">
                          New tasks start as Open.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                    <div className="flex flex-col gap-3 border-b border-base-300 bg-base-200/40 p-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">Task Context</div>
                        <div className="mt-1 text-xs text-base-content/50">
                          Add the reason, next action, or conversation note for this task.
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {quickContextOptions.map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => appendTaskContext(option.value)}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      className="min-h-[130px] w-full resize-none bg-base-100 p-4 text-sm leading-7 outline-none placeholder:text-base-content/35"
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
                      {taskFormMode === 'edit' ? (
                        <>
                          Editing task:{' '}
                          <span className="font-semibold text-base-content">
                            {taskForm.title || 'Untitled task'}
                          </span>
                        </>
                      ) : (
                        <>
                          New task will be created for:{' '}
                          <span className="font-semibold text-base-content">
                            {selectedStore?.name || 'No store selected'}
                          </span>
                          {taskForm.dueDate && (
                            <>
                              {' '}
                              on{' '}
                              <span className="font-semibold text-base-content">
                                {taskForm.dueDate} at {taskForm.dueTime || '09:00'}
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn btn-ghost" onClick={resetCreateTaskForm}>
                        Reset
                      </button>

                      <button
                        type="button"
                        className={`btn btn-primary min-w-[150px] ${
                          isSavingTask ? 'btn-disabled' : ''
                        }`}
                        onClick={submitTaskForm}
                      >
                        {isSavingTask ? (
                          <>
                            <span className="loading loading-spinner loading-sm" />
                            Saving
                          </>
                        ) : taskFormMode === 'edit' ? (
                          'Save Changes'
                        ) : (
                          'Create Task'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-3xl border border-base-300 bg-base-100">
                <div className="flex items-center justify-between gap-3 border-b border-base-300 p-4">
                  <div>
                    <h4 className="font-semibold">Tasks / Follow-ups</h4>
                    <p className="mt-1 text-xs text-base-content/50">
                      Open, in-progress, overdue, or scheduled work.
                    </p>
                  </div>

                  <span className="badge badge-primary badge-outline">{selectedDayTasks.length}</span>
                </div>

                <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
                  {selectedDayTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-6 text-center">
                      <div className="text-3xl">✅</div>
                      <div className="mt-2 font-semibold">No tasks for this day</div>
                      <p className="mt-1 text-sm text-base-content/60">
                        There are no scheduled CRM tasks or follow-ups.
                      </p>
                    </div>
                  ) : (
                    selectedDayTasks.map((item) => (
                      <DayItemCard
                        key={item.id}
                        item={item}
                        onOpenStore={onOpenStore}
                        onEditTask={startEditTask}
                        onCompleteTask={completeTask}
                        onDeleteTask={deleteTask}
                        isActing={actingTaskId === item.taskId}
                      />
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-base-300 bg-base-100">
                <div className="flex items-center justify-between gap-3 border-b border-base-300 p-4">
                  <div>
                    <h4 className="font-semibold">Work Done</h4>
                    <p className="mt-1 text-xs text-base-content/50">
                      Completed tasks and funnel activity history.
                    </p>
                  </div>

                  <span className="badge badge-success badge-outline">
                    {selectedDayWorkDone.length}
                  </span>
                </div>

                <div className="max-h-[560px] space-y-3 overflow-y-auto p-4">
                  {selectedDayWorkDone.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/40 p-6 text-center">
                      <div className="text-3xl">📝</div>
                      <div className="mt-2 font-semibold">No work done recorded</div>
                      <p className="mt-1 text-sm text-base-content/60">
                        No completed tasks or funnel events are recorded for this day.
                      </p>
                    </div>
                  ) : (
                    selectedDayWorkDone.map((item) => (
                      <DayItemCard
                        key={item.id}
                        item={item}
                        onOpenStore={onOpenStore}
                        onEditTask={startEditTask}
                        onCompleteTask={completeTask}
                        onDeleteTask={deleteTask}
                        isActing={actingTaskId === item.taskId}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedDay(null)}
              >
                Close
              </button>
            </div>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={() => setSelectedDay(null)}>
              close
            </button>
          </form>
        </dialog>
      )}
    </div>
  );
}