import { DashboardLayout } from '@/components/layouts';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type StoreCrm = {
    funnelStage?: string;
    leadStatus?: string;
    fitScore?: number;
    priority?: string;
    painAngle?: string;
};

type StoreLead = {
    _id: string;
    name: string;
    domain: string;
    contactName?: string;
    contactEmail?: string;
    crm?: StoreCrm;
};

type EmployeeTask = {
    _id: string;
    storeId?: StoreLead;
    title: string;
    description?: string;
    reason?: string;
    type: string;
    status: 'open' | 'in_progress' | 'completed' | 'cancelled';
    priority: 'low' | 'medium' | 'high';
    dueAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    estimatedMinutes?: number;
    actualMinutes?: number | null;
    source?: string;
    sourceRule?: string;
};

type MyDayResponse = {
    date: string;
    tasks: EmployeeTask[];
    overdueTasks: EmployeeTask[];
    completedToday: EmployeeTask[];
    summary: {
        assignedToday: number;
        overdue: number;
        completedToday: number;
        remainingToday: number;
        estimatedMinutes: number;
        completedMinutes: number;
    };
};

type CompleteForm = {
    taskId: string;
    actualMinutes: string;
    note: string;
};

type RescheduleForm = {
    taskId: string;
    dueAt: string;
};

type TaskStatusFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'overdue';
type TaskPriorityFilter = 'all' | 'low' | 'medium' | 'high';

type TaskFilters = {
    status: TaskStatusFilter;
    priority: TaskPriorityFilter;
    type: string;
    search: string;
};

const DEFAULT_TASK_FILTERS: TaskFilters = {
    status: 'all',
    priority: 'all',
    type: 'all',
    search: '',
};

const STATUS_FILTER_OPTIONS: Array<{
    value: TaskStatusFilter;
    label: string;
}> = [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'Work in progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' },
];

const PRIORITY_FILTER_OPTIONS: Array<{
    value: TaskPriorityFilter;
    label: string;
}> = [
    { value: 'all', label: 'All priorities' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
];

function toDateInput(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}`;
}

function toDateTimeInput(value?: string | null) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '';

    const pad = (input: number) => String(input).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
        date.getDate()
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

function formatTime(value?: string | null) {
    if (!value) return '-';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getPriorityClass(priority?: string) {
    if (priority === 'high') return 'badge-error';
    if (priority === 'low') return 'badge-ghost';

    return 'badge-warning';
}

function getStatusClass(status?: string) {
    if (status === 'completed') return 'badge-success';
    if (status === 'in_progress') return 'badge-info';
    if (status === 'cancelled') return 'badge-error';

    return 'badge-outline';
}

function getStageClass(stage?: string) {
    if (['won', 'activated'].includes(stage || '')) return 'badge-success';
    if (stage === 'lost') return 'badge-error';
    if (['contacted', 'engaged', 'installed'].includes(stage || '')) {
        return 'badge-info';
    }
    if (stage === 'qualified') return 'badge-primary';

    return 'badge-ghost';
}

function getTaskSortValue(task: EmployeeTask) {
    const priorityWeight =
        {
            high: 3,
            medium: 2,
            low: 1,
        }[task.priority || 'medium'] || 2;

    const statusWeight =
        {
            in_progress: 3,
            open: 2,
            completed: 1,
            cancelled: 0,
        }[task.status || 'open'] || 2;

    const dueTime = task.dueAt ? new Date(task.dueAt).getTime() : 0;

    return statusWeight * 10000000000000 + priorityWeight * 1000000000000 - dueTime;
}

function normalizeSearchValue(value?: string | number | null) {
    return String(value || '').toLowerCase().trim();
}

function taskMatchesSearch(task: EmployeeTask, search: string) {
    const query = normalizeSearchValue(search);

    if (!query) return true;

    const store = task.storeId;
    const crm = store?.crm || {};

    const searchableText = [
        task.title,
        task.description,
        task.reason,
        task.type,
        task.status,
        task.priority,
        task.source,
        task.sourceRule,
        store?.name,
        store?.domain,
        store?.contactName,
        store?.contactEmail,
        crm.funnelStage,
        crm.leadStatus,
        crm.priority,
        crm.painAngle,
        crm.fitScore,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    return searchableText.includes(query);
}

function taskMatchesFilters({
    task,
    filters,
    isOverdue = false,
}: {
    task: EmployeeTask;
    filters: TaskFilters;
    isOverdue?: boolean;
}) {
    if (filters.status === 'overdue' && !isOverdue) {
        return false;
    }

    if (
        filters.status !== 'all' &&
        filters.status !== 'overdue' &&
        task.status !== filters.status
    ) {
        return false;
    }

    if (filters.priority !== 'all' && task.priority !== filters.priority) {
        return false;
    }

    if (filters.type !== 'all' && task.type !== filters.type) {
        return false;
    }

    if (!taskMatchesSearch(task, filters.search)) {
        return false;
    }

    return true;
}

function getUniqueTaskTypes(data: MyDayResponse | null) {
    const types = new Set<string>();

    [
        ...(data?.tasks || []),
        ...(data?.overdueTasks || []),
        ...(data?.completedToday || []),
    ].forEach((task) => {
        if (task.type) {
            types.add(task.type);
        }
    });

    return Array.from(types).sort();
}

function TaskCard({
    task,
    isOverdue = false,
    onStart,
    onComplete,
    onReschedule,
    onCancel,
}: {
    task: EmployeeTask;
    isOverdue?: boolean;
    onStart: (task: EmployeeTask) => void;
    onComplete: (task: EmployeeTask) => void;
    onReschedule: (task: EmployeeTask) => void;
    onCancel: (task: EmployeeTask) => void;
}) {
    const store = task.storeId;
    const crm = store?.crm || {};

    return (
        <div
            className={`rounded-3xl border bg-base-100 p-5 shadow-sm transition hover:shadow-md ${
                isOverdue ? 'border-error/30' : 'border-base-300'
            }`}
        >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {isOverdue && (
                            <span className="badge badge-error badge-outline">
                                Overdue
                            </span>
                        )}

                        <span className={`badge ${getStatusClass(task.status)}`}>
                            {humanize(task.status)}
                        </span>

                        <span
                            className={`badge badge-outline ${getPriorityClass(
                                task.priority
                            )}`}
                        >
                            {humanize(task.priority)}
                        </span>

                        <span className="badge badge-ghost">
                            {humanize(task.type)}
                        </span>

                        {task.source && (
                            <span className="badge badge-primary badge-outline">
                                {humanize(task.source)}
                            </span>
                        )}
                    </div>

                    <h3 className="mt-3 text-lg font-bold text-base-content">
                        {task.title}
                    </h3>

                    {task.description && (
                        <p className="mt-2 text-sm leading-6 text-base-content/70">
                            {task.description}
                        </p>
                    )}

                    {task.reason && (
                        <div className="mt-3 rounded-2xl border border-info/20 bg-info/10 p-3 text-sm leading-6 text-base-content/70">
                            <span className="font-semibold text-info">Reason: </span>
                            {task.reason}
                        </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl bg-base-200/60 p-3">
                            <div className="text-xs text-base-content/50">Due</div>
                            <div className="mt-1 font-semibold">
                                {formatDateTime(task.dueAt)}
                            </div>
                        </div>

                        <div className="rounded-2xl bg-base-200/60 p-3">
                            <div className="text-xs text-base-content/50">
                                Estimated
                            </div>
                            <div className="mt-1 font-semibold">
                                {task.estimatedMinutes || 0} min
                            </div>
                        </div>

                        <div className="rounded-2xl bg-base-200/60 p-3">
                            <div className="text-xs text-base-content/50">Stage</div>
                            <div className="mt-1">
                                <span
                                    className={`badge badge-outline ${getStageClass(
                                        crm.funnelStage
                                    )}`}
                                >
                                    {humanize(crm.funnelStage || 'discovered')}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-2xl bg-base-200/60 p-3">
                            <div className="text-xs text-base-content/50">Status</div>
                            <div className="mt-1 font-semibold">
                                {humanize(crm.leadStatus || 'new')}
                            </div>
                        </div>
                    </div>

                    {store && (
                        <div className="mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-4">
                            <div className="font-semibold text-base-content">
                                {store.name}
                            </div>

                            <div className="mt-1 flex flex-wrap gap-3 text-xs text-base-content/60">
                                <span>{store.domain}</span>
                                {store.contactEmail && <span>{store.contactEmail}</span>}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex min-w-[210px] flex-col gap-2">
                    <div className="rounded-2xl border border-base-300 bg-base-200/40 p-3 text-center">
                        <div className="text-xs text-base-content/50">Due time</div>
                        <div className="mt-1 text-xl font-black text-primary">
                            {formatTime(task.dueAt)}
                        </div>
                    </div>

                    {task.status === 'open' && (
                        <button
                            type="button"
                            className="btn btn-info btn-sm"
                            onClick={() => onStart(task)}
                        >
                            Start
                        </button>
                    )}

                    {['open', 'in_progress'].includes(task.status) && (
                        <>
                            <button
                                type="button"
                                className="btn btn-success btn-sm"
                                onClick={() => onComplete(task)}
                            >
                                Done
                            </button>

                            <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => onReschedule(task)}
                            >
                                Reschedule
                            </button>

                            <button
                                type="button"
                                className="btn btn-error btn-outline btn-sm"
                                onClick={() => onCancel(task)}
                            >
                                Cancel
                            </button>
                        </>
                    )}

                    {store?._id && (
                        <Link
                            href={`/dashboard/stores/${store._id}/crm`}
                            className="btn btn-ghost btn-sm"
                        >
                            Open Store CRM
                        </Link>
                    )}
                </div>
            </div>
        </div>
    );
}

function MyTasksPage() {
    const [selectedDate, setSelectedDate] = useState(toDateInput());
    const [data, setData] = useState<MyDayResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [actingTaskId, setActingTaskId] = useState('');

    const [filters, setFilters] = useState<TaskFilters>(DEFAULT_TASK_FILTERS);

    const [completeForm, setCompleteForm] = useState<CompleteForm | null>(null);
    const [rescheduleForm, setRescheduleForm] = useState<RescheduleForm | null>(
        null
    );

    const taskTypes = useMemo(() => {
        return getUniqueTaskTypes(data);
    }, [data]);

    const sortedTasks = useMemo(() => {
        return [...(data?.tasks || [])]
            .filter((task) =>
                taskMatchesFilters({
                    task,
                    filters,
                    isOverdue: false,
                })
            )
            .sort((a, b) => {
                return getTaskSortValue(b) - getTaskSortValue(a);
            });
    }, [data?.tasks, filters]);

    const filteredOverdueTasks = useMemo(() => {
        return [...(data?.overdueTasks || [])].filter((task) =>
            taskMatchesFilters({
                task,
                filters,
                isOverdue: true,
            })
        );
    }, [data?.overdueTasks, filters]);

    const filteredCompletedToday = useMemo(() => {
        return [...(data?.completedToday || [])].filter((task) =>
            taskMatchesFilters({
                task,
                filters,
                isOverdue: false,
            })
        );
    }, [data?.completedToday, filters]);

    const filteredTotal =
        sortedTasks.length + filteredOverdueTasks.length + filteredCompletedToday.length;

    const rawTotal =
        (data?.tasks || []).length +
        (data?.overdueTasks || []).length +
        (data?.completedToday || []).length;

    const hasActiveFilters =
        filters.status !== 'all' ||
        filters.priority !== 'all' ||
        filters.type !== 'all' ||
        Boolean(filters.search.trim());

    const loadMyDay = async () => {
        try {
            setIsLoading(true);

            const response = await api.get('/employee-tasks/my-day', {
                params: {
                    date: selectedDate,
                },
            });

            setData(response?.data?.data || null);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to load daily tasks.'));
        } finally {
            setIsLoading(false);
        }
    };

    const startTask = async (task: EmployeeTask) => {
        try {
            setActingTaskId(task._id);

            await api.patch(`/employee-tasks/${task._id}/start`);

            toast.success('Task started.');
            await loadMyDay();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to start task.'));
        } finally {
            setActingTaskId('');
        }
    };

    const submitComplete = async () => {
        if (!completeForm?.taskId) return;

        try {
            setActingTaskId(completeForm.taskId);

            await api.patch(`/employee-tasks/${completeForm.taskId}/complete`, {
                actualMinutes: completeForm.actualMinutes || null,
                note: completeForm.note,
            });

            toast.success('Task completed.');
            setCompleteForm(null);
            await loadMyDay();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to complete task.'));
        } finally {
            setActingTaskId('');
        }
    };

    const submitReschedule = async () => {
        if (!rescheduleForm?.taskId) return;

        if (!rescheduleForm.dueAt) {
            toast.error('Select a new due date.');
            return;
        }

        try {
            setActingTaskId(rescheduleForm.taskId);

            await api.patch(`/employee-tasks/${rescheduleForm.taskId}/reschedule`, {
                dueAt: rescheduleForm.dueAt,
            });

            toast.success('Task rescheduled.');
            setRescheduleForm(null);
            await loadMyDay();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to reschedule task.'));
        } finally {
            setActingTaskId('');
        }
    };

    const cancelTask = async (task: EmployeeTask) => {
        try {
            setActingTaskId(task._id);

            await api.patch(`/employee-tasks/${task._id}/cancel`, {
                note: `Task cancelled from employee panel: ${task.title}`,
            });

            toast.success('Task cancelled.');
            await loadMyDay();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to cancel task.'));
        } finally {
            setActingTaskId('');
        }
    };

    const moveDate = (days: number) => {
        const date = new Date(selectedDate);
        date.setDate(date.getDate() + days);
        setSelectedDate(toDateInput(date));
    };

    useEffect(() => {
        loadMyDay();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

    return (
        <DashboardLayout>
            <Head>
                <title>My Tasks | Marketing Assistant Panel</title>
            </Head>

            <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
                <div className="mx-auto max-w-[1500px] space-y-6 px-4 md:px-6">
                    <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
                        <div className="border-b border-base-300 p-5 md:p-7">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-2xl font-bold text-base-content md:text-3xl">
                                            My Daily Tasks
                                        </h1>

                                        <span className="badge badge-primary badge-outline">
                                            Employee Panel
                                        </span>

                                        <span className="badge badge-success badge-outline">
                                            Real Assigned Tasks
                                        </span>
                                    </div>

                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/70">
                                        This panel shows only real CRM tasks assigned to you.
                                        Suggestions are not shown here until they are accepted and
                                        converted into tasks.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => moveDate(-1)}
                                    >
                                        Previous
                                    </button>

                                    <input
                                        type="date"
                                        className="input input-bordered bg-base-100"
                                        value={selectedDate}
                                        onChange={(event) =>
                                            setSelectedDate(event.target.value)
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={() => moveDate(1)}
                                    >
                                        Next
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={() => setSelectedDate(toDateInput())}
                                    >
                                        Today
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                                <div className="rounded-2xl bg-base-200/60 p-4">
                                    <div className="text-xs text-base-content/50">
                                        Assigned
                                    </div>
                                    <div className="mt-1 text-2xl font-black">
                                        {data?.summary?.assignedToday || 0}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-error/10 p-4">
                                    <div className="text-xs text-error/70">Overdue</div>
                                    <div className="mt-1 text-2xl font-black text-error">
                                        {data?.summary?.overdue || 0}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-success/10 p-4">
                                    <div className="text-xs text-success/70">
                                        Completed
                                    </div>
                                    <div className="mt-1 text-2xl font-black text-success">
                                        {data?.summary?.completedToday || 0}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-warning/10 p-4">
                                    <div className="text-xs text-warning/70">
                                        Remaining
                                    </div>
                                    <div className="mt-1 text-2xl font-black text-warning">
                                        {data?.summary?.remainingToday || 0}
                                    </div>
                                </div>

                                <div className="rounded-2xl bg-primary/10 p-4">
                                    <div className="text-xs text-primary/70">
                                        Estimated
                                    </div>
                                    <div className="mt-1 text-2xl font-black text-primary">
                                        {data?.summary?.estimatedMinutes || 0}m
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 rounded-3xl border border-base-300 bg-base-200/40 p-4">
                                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-base font-bold text-base-content">
                                            Task Filters
                                        </h2>
                                        <p className="mt-1 text-sm text-base-content/60">
                                            Filter your tasks by status, priority, type, or
                                            search text.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="badge badge-primary badge-outline">
                                            {filteredTotal} visible
                                        </span>

                                        <span className="badge badge-ghost">
                                            {rawTotal} total
                                        </span>

                                        {hasActiveFilters && (
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-sm"
                                                onClick={() =>
                                                    setFilters(DEFAULT_TASK_FILTERS)
                                                }
                                            >
                                                Clear filters
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Status</span>
                                        </label>

                                        <select
                                            className="select select-bordered bg-base-100"
                                            value={filters.status}
                                            onChange={(event) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    status: event.target
                                                        .value as TaskStatusFilter,
                                                }))
                                            }
                                        >
                                            {STATUS_FILTER_OPTIONS.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Priority</span>
                                        </label>

                                        <select
                                            className="select select-bordered bg-base-100"
                                            value={filters.priority}
                                            onChange={(event) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    priority: event.target
                                                        .value as TaskPriorityFilter,
                                                }))
                                            }
                                        >
                                            {PRIORITY_FILTER_OPTIONS.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Task type</span>
                                        </label>

                                        <select
                                            className="select select-bordered bg-base-100"
                                            value={filters.type}
                                            onChange={(event) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    type: event.target.value,
                                                }))
                                            }
                                        >
                                            <option value="all">All types</option>

                                            {taskTypes.map((type) => (
                                                <option key={type} value={type}>
                                                    {humanize(type)}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Search</span>
                                        </label>

                                        <input
                                            type="text"
                                            className="input input-bordered bg-base-100"
                                            placeholder="Search task, store, domain..."
                                            value={filters.search}
                                            onChange={(event) =>
                                                setFilters((current) => ({
                                                    ...current,
                                                    search: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 md:p-7">
                            {isLoading ? (
                                <div className="flex min-h-[300px] items-center justify-center">
                                    <span className="loading loading-spinner loading-lg text-primary" />
                                </div>
                            ) : (
                                <>
                                    {filteredOverdueTasks.length > 0 && (
                                        <div className="mb-6 rounded-3xl border border-error/20 bg-error/5 p-5">
                                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="text-lg font-bold text-error">
                                                        Overdue Tasks
                                                    </h2>
                                                    <p className="mt-1 text-sm text-error/70">
                                                        These tasks are still open or in
                                                        progress and passed their due date.
                                                    </p>
                                                </div>

                                                <span className="badge badge-error badge-outline">
                                                    {filteredOverdueTasks.length} visible
                                                </span>
                                            </div>

                                            <div className="space-y-4">
                                                {filteredOverdueTasks.map((task) => (
                                                    <TaskCard
                                                        key={task._id}
                                                        task={task}
                                                        isOverdue
                                                        onStart={startTask}
                                                        onComplete={(item) =>
                                                            setCompleteForm({
                                                                taskId: item._id,
                                                                actualMinutes: String(
                                                                    item.estimatedMinutes || ''
                                                                ),
                                                                note: '',
                                                            })
                                                        }
                                                        onReschedule={(item) =>
                                                            setRescheduleForm({
                                                                taskId: item._id,
                                                                dueAt: toDateTimeInput(
                                                                    item.dueAt
                                                                ),
                                                            })
                                                        }
                                                        onCancel={cancelTask}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <h2 className="text-lg font-bold">
                                                    Tasks for Selected Day
                                                </h2>
                                                <p className="mt-1 text-sm text-base-content/60">
                                                    Date: {selectedDate}
                                                </p>
                                            </div>

                                            <span className="badge badge-primary badge-outline">
                                                {sortedTasks.length} visible tasks
                                            </span>
                                        </div>

                                        {sortedTasks.length === 0 ? (
                                            <div className="rounded-3xl border border-dashed border-base-300 bg-base-200/40 px-6 py-16 text-center">
                                                <div className="text-4xl">✅</div>

                                                <h3 className="mt-3 text-lg font-semibold">
                                                    {hasActiveFilters
                                                        ? 'No tasks match your filters'
                                                        : 'No assigned tasks for this day'}
                                                </h3>

                                                <p className="mt-2 text-sm text-base-content/60">
                                                    {hasActiveFilters
                                                        ? 'Change or clear the filters to see more tasks.'
                                                        : 'The planner has not assigned any real task to you for this date.'}
                                                </p>

                                                {hasActiveFilters && (
                                                    <button
                                                        type="button"
                                                        className="btn btn-primary btn-sm mt-5"
                                                        onClick={() =>
                                                            setFilters(
                                                                DEFAULT_TASK_FILTERS
                                                            )
                                                        }
                                                    >
                                                        Clear filters
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                {sortedTasks.map((task) => (
                                                    <TaskCard
                                                        key={task._id}
                                                        task={task}
                                                        onStart={startTask}
                                                        onComplete={(item) =>
                                                            setCompleteForm({
                                                                taskId: item._id,
                                                                actualMinutes: String(
                                                                    item.estimatedMinutes || ''
                                                                ),
                                                                note: '',
                                                            })
                                                        }
                                                        onReschedule={(item) =>
                                                            setRescheduleForm({
                                                                taskId: item._id,
                                                                dueAt: toDateTimeInput(
                                                                    item.dueAt
                                                                ),
                                                            })
                                                        }
                                                        onCancel={cancelTask}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {filteredCompletedToday.length > 0 && (
                                        <div className="mt-6 rounded-3xl border border-success/20 bg-success/5 p-5">
                                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <h2 className="text-lg font-bold text-success">
                                                        Completed Today
                                                    </h2>
                                                    <p className="mt-1 text-sm text-success/70">
                                                        Tasks completed on the selected date.
                                                    </p>
                                                </div>

                                                <span className="badge badge-success badge-outline">
                                                    {filteredCompletedToday.length} visible
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                                                {filteredCompletedToday.map((task) => (
                                                    <div
                                                        key={task._id}
                                                        className="rounded-2xl border border-success/20 bg-base-100 p-4"
                                                    >
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="badge badge-success badge-outline">
                                                                Completed
                                                            </span>

                                                            <span className="badge badge-ghost">
                                                                {humanize(task.type)}
                                                            </span>

                                                            <span
                                                                className={`badge badge-outline ${getPriorityClass(
                                                                    task.priority
                                                                )}`}
                                                            >
                                                                {humanize(task.priority)}
                                                            </span>
                                                        </div>

                                                        <div className="mt-2 font-semibold">
                                                            {task.title}
                                                        </div>

                                                        {task.storeId && (
                                                            <div className="mt-1 text-xs text-base-content/60">
                                                                {task.storeId.name}
                                                                {task.storeId.domain
                                                                    ? ` · ${task.storeId.domain}`
                                                                    : ''}
                                                            </div>
                                                        )}

                                                        <div className="mt-1 text-xs text-base-content/50">
                                                            Completed:{' '}
                                                            {formatDateTime(
                                                                task.completedAt
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {completeForm && (
                        <dialog open className="modal">
                            <div className="modal-box rounded-3xl">
                                <h3 className="text-lg font-bold">Complete task</h3>

                                <div className="mt-5 space-y-4">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">
                                                Actual minutes
                                            </span>
                                        </label>

                                        <input
                                            type="number"
                                            min={0}
                                            className="input input-bordered bg-base-100"
                                            value={completeForm.actualMinutes}
                                            onChange={(event) =>
                                                setCompleteForm((current) =>
                                                    current
                                                        ? {
                                                              ...current,
                                                              actualMinutes:
                                                                  event.target.value,
                                                          }
                                                        : current
                                                )
                                            }
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">
                                                Completion note
                                            </span>
                                        </label>

                                        <textarea
                                            className="textarea textarea-bordered min-h-[120px]"
                                            value={completeForm.note}
                                            onChange={(event) =>
                                                setCompleteForm((current) =>
                                                    current
                                                        ? {
                                                              ...current,
                                                              note: event.target.value,
                                                          }
                                                        : current
                                                )
                                            }
                                            placeholder="What was done?"
                                        />
                                    </div>
                                </div>

                                <div className="modal-action">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setCompleteForm(null)}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className={`btn btn-success ${
                                            actingTaskId === completeForm.taskId
                                                ? 'btn-disabled'
                                                : ''
                                        }`}
                                        onClick={submitComplete}
                                    >
                                        {actingTaskId === completeForm.taskId ? (
                                            <>
                                                <span className="loading loading-spinner loading-sm" />
                                                Saving
                                            </>
                                        ) : (
                                            'Complete'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <form method="dialog" className="modal-backdrop">
                                <button
                                    type="button"
                                    onClick={() => setCompleteForm(null)}
                                >
                                    close
                                </button>
                            </form>
                        </dialog>
                    )}

                    {rescheduleForm && (
                        <dialog open className="modal">
                            <div className="modal-box rounded-3xl">
                                <h3 className="text-lg font-bold">Reschedule task</h3>

                                <div className="mt-5">
                                    <label className="label">
                                        <span className="label-text">New due date</span>
                                    </label>

                                    <input
                                        type="datetime-local"
                                        className="input input-bordered w-full bg-base-100"
                                        value={rescheduleForm.dueAt}
                                        onChange={(event) =>
                                            setRescheduleForm((current) =>
                                                current
                                                    ? {
                                                          ...current,
                                                          dueAt: event.target.value,
                                                      }
                                                    : current
                                            )
                                        }
                                    />
                                </div>

                                <div className="modal-action">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setRescheduleForm(null)}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className={`btn btn-primary ${
                                            actingTaskId === rescheduleForm.taskId
                                                ? 'btn-disabled'
                                                : ''
                                        }`}
                                        onClick={submitReschedule}
                                    >
                                        {actingTaskId === rescheduleForm.taskId ? (
                                            <>
                                                <span className="loading loading-spinner loading-sm" />
                                                Saving
                                            </>
                                        ) : (
                                            'Reschedule'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <form method="dialog" className="modal-backdrop">
                                <button
                                    type="button"
                                    onClick={() => setRescheduleForm(null)}
                                >
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

export default dynamic(() => Promise.resolve(MyTasksPage), {
    ssr: false,
});