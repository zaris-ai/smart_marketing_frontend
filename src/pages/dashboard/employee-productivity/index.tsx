import { DashboardLayout } from '@/components/layouts';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type Distribution = Record<string, number>;

type ProductivityTask = {
    _id: string;
    title: string;
    type: string;
    status: string;
    priority: string;
    dueAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    cancelledAt?: string | null;
    estimatedMinutes: number;
    actualMinutes?: number | null;
    completedMinutes: number;
    source?: string;
    sourceRule?: string;
    store?: {
        _id: string;
        name: string;
        domain: string;
        contactEmail?: string;
    } | null;
};

type DailyPoint = {
    date: string;
    assigned: number;
    started: number;
    completed: number;
    cancelled: number;
    overdueOpen: number;
    estimatedMinutes: number;
    completedMinutes: number;
    onTimeCompleted: number;
};

type EmployeeProductivity = {
    employee: {
        _id: string;
        username: string;
        displayName: string;
        role: string;
        skills: string[];
        workingHoursPerDay: number;
        workingDays: number[];
        efficiencyFactor: number;
        maxTasksPerDay: number;
        dailyCapacityMinutes: number;
        workingDaysInRange: number;
        capacityMinutes: number;
    };
    totals: {
        assignedTasks: number;
        startedTasks: number;
        openTasks: number;
        inProgressTasks: number;
        completedTasks: number;
        cancelledTasks: number;
        overdueOpenTasks: number;
        onTimeCompletedTasks: number;
        lateCompletedTasks: number;
        noDueDateCompletedTasks: number;
        estimatedMinutes: number;
        completedMinutes: number;
        actualMinutes: number;
        plannedCompletedMinutes: number;
        averageDelayHours?: number;
        averageLeadTimeHours?: number;
        averageCompletionDurationHours?: number;
    };
    rates: {
        completionRate: number;
        onTimeRate: number;
        overdueOpenRate: number;
        timeAccuracyRate: number;
        workloadUtilizationRate: number;
        productiveUtilizationRate: number;
        productivityScore: number;
    };
    distributions: {
        status: Distribution;
        priority: Distribution;
        type: Distribution;
        source: Distribution;
    };
    daily: DailyPoint[];
    recentCompleted: ProductivityTask[];
    overdueTasks: ProductivityTask[];
};

type LeaderboardPoint = {
    rank: number;
    employeeId: string;
    employeeName: string;
    role: string;
    productivityScore: number;
    completionRate: number;
    onTimeRate: number;
    productiveUtilizationRate: number;
    assignedTasks: number;
    completedTasks: number;
    overdueOpenTasks: number;
    completedMinutes: number;
    capacityMinutes: number;
};

type WorkloadPoint = {
    employeeId: string;
    employeeName: string;
    assignedTasks: number;
    completedTasks: number;
    openTasks: number;
    inProgressTasks: number;
    overdueOpenTasks: number;
    estimatedMinutes: number;
    completedMinutes: number;
    capacityMinutes: number;
};

type Insight = {
    type: string;
    severity: 'positive' | 'warning' | 'neutral' | string;
    title: string;
    description: string;
    employeeId?: string;
};

type ProductivityReport = {
    filters: {
        start: string;
        end: string;
        employeeId: string;
        days: number;
    };
    summary: {
        employees: number;
        assignedTasks: number;
        completedTasks: number;
        openTasks: number;
        inProgressTasks: number;
        cancelledTasks: number;
        overdueOpenTasks: number;
        estimatedMinutes: number;
        completedMinutes: number;
        capacityMinutes: number;
        completionRate: number;
        onTimeRate: number;
        productiveUtilizationRate: number;
        averageProductivityScore: number;
    };
    employees: EmployeeProductivity[];
    charts: {
        dailySeries: DailyPoint[];
        distributions: {
            status: Distribution;
            priority: Distribution;
            type: Distribution;
            source: Distribution;
        };
        leaderboard: LeaderboardPoint[];
        workloadByEmployee: WorkloadPoint[];
    };
    insights: Insight[];
    generatedAt: string;
};

type EmployeeOption = {
    value: string;
    label: string;
    meta: string;
};

const FILTER_STORAGE_KEY = 'employee-productivity-filters-v1';

function toDateInput(date = new Date()) {
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function defaultStartDate() {
    return toDateInput(addDays(new Date(), -29));
}

function defaultEndDate() {
    return toDateInput(new Date());
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

function formatDate(value?: string | null) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
    if (!value) return '-';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';

    return date.toLocaleString();
}

function formatMinutes(minutes?: number | null) {
    const value = Number(minutes || 0);

    if (value < 60) return `${Math.round(value)}m`;

    const hours = Math.floor(value / 60);
    const remainder = Math.round(value % 60);

    if (!remainder) return `${hours}h`;

    return `${hours}h ${remainder}m`;
}

function formatNumber(value?: number | null, decimals = 0) {
    const number = Number(value || 0);
    return number.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

function clamp(value: number, min = 0, max = 100) {
    return Math.min(Math.max(value, min), max);
}

function getPercent(value?: number | null) {
    return `${clamp(Number(value || 0), 0, 100)}%`;
}

function getScoreClass(score?: number) {
    const value = Number(score || 0);

    if (value >= 80) return 'text-success';
    if (value >= 55) return 'text-warning';

    return 'text-error';
}

function getScoreBadgeClass(score?: number) {
    const value = Number(score || 0);

    if (value >= 80) return 'badge-success';
    if (value >= 55) return 'badge-warning';

    return 'badge-error';
}

function getSeverityClass(severity?: string) {
    if (severity === 'positive') return 'border-success/30 bg-success/5 text-success';
    if (severity === 'warning') return 'border-warning/30 bg-warning/5 text-warning';

    return 'border-info/30 bg-info/5 text-info';
}

function distributionToRows(distribution: Distribution = {}) {
    return Object.entries(distribution)
        .map(([label, value]) => ({ label, value: Number(value || 0) }))
        .sort((a, b) => b.value - a.value);
}

function getMaxValue(values: number[]) {
    const max = Math.max(...values, 0);
    return max <= 0 ? 1 : max;
}

function buildEmployeeOptions(report: ProductivityReport | null): EmployeeOption[] {
    return (report?.employees || [])
        .map((item) => ({
            value: item.employee._id,
            label: item.employee.displayName || item.employee.username,
            meta: humanize(item.employee.role),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
}

function KpiCard({
    label,
    value,
    subValue,
    tone = 'base',
}: {
    label: string;
    value: string | number;
    subValue?: string;
    tone?: 'base' | 'primary' | 'success' | 'warning' | 'error' | 'info';
}) {
    const toneClass = {
        base: 'border-base-300 bg-base-100',
        primary: 'border-primary/20 bg-primary/5',
        success: 'border-success/20 bg-success/5',
        warning: 'border-warning/20 bg-warning/5',
        error: 'border-error/20 bg-error/5',
        info: 'border-info/20 bg-info/5',
    }[tone];

    return (
        <div className={`rounded-3xl border p-5 ${toneClass}`}>
            <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">
                {label}
            </div>

            <div className="mt-2 text-2xl font-black text-base-content">
                {value}
            </div>

            {subValue ? (
                <div className="mt-1 text-sm text-base-content/60">
                    {subValue}
                </div>
            ) : null}
        </div>
    );
}

function ProgressBar({ value, label }: { value: number; label?: string }) {
    return (
        <div>
            {label ? (
                <div className="mb-1 flex items-center justify-between text-xs text-base-content/60">
                    <span>{label}</span>
                    <span>{formatNumber(value, 1)}%</span>
                </div>
            ) : null}

            <div className="h-2 overflow-hidden rounded-full bg-base-300">
                <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: getPercent(value) }}
                />
            </div>
        </div>
    );
}

function LeaderboardBarChart({ data }: { data: LeaderboardPoint[] }) {
    const rows = data.slice(0, 10);
    const max = getMaxValue(rows.map((item) => item.productivityScore));

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold">Productivity score leaderboard</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                        Score combines completion, on-time performance, utilization, time accuracy, and overdue penalty.
                    </p>
                </div>

                <span className="badge badge-primary badge-outline">
                    Top {rows.length}
                </span>
            </div>

            <div className="space-y-4">
                {rows.map((item) => (
                    <div key={item.employeeId}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <div className="min-w-0">
                                <span className="font-semibold">
                                    #{item.rank} {item.employeeName}
                                </span>
                                <span className="ml-2 text-xs text-base-content/50">
                                    {humanize(item.role)}
                                </span>
                            </div>

                            <span className={`font-black ${getScoreClass(item.productivityScore)}`}>
                                {formatNumber(item.productivityScore, 1)}%
                            </span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-base-300">
                            <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${(item.productivityScore / max) * 100}%` }}
                            />
                        </div>

                        <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-base-content/50">
                            <span>Completed: {item.completedTasks}/{item.assignedTasks}</span>
                            <span>On-time: {formatNumber(item.onTimeRate, 1)}%</span>
                            <span>Overdue: {item.overdueOpenTasks}</span>
                        </div>
                    </div>
                ))}

                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-base-300 py-10 text-center text-sm text-base-content/50">
                        No employee productivity data found for this range.
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function DailyTrendChart({ data }: { data: DailyPoint[] }) {
    const width = 900;
    const height = 280;
    const padding = 34;
    const rows = data || [];
    const maxY = getMaxValue(
        rows.flatMap((item) => [item.assigned, item.completed, item.overdueOpen])
    );
    const stepX = rows.length > 1 ? (width - padding * 2) / (rows.length - 1) : 0;

    const point = (index: number, value: number) => {
        const x = padding + index * stepX;
        const y = height - padding - (value / maxY) * (height - padding * 2);
        return `${x},${y}`;
    };

    const toPolyline = (key: keyof DailyPoint) =>
        rows.map((item, index) => point(index, Number(item[key] || 0))).join(' ');

    const xLabels = rows.filter((_, index) => {
        if (rows.length <= 8) return true;
        return index === 0 || index === rows.length - 1 || index % Math.ceil(rows.length / 6) === 0;
    });

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-bold">Daily trend</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                        Assigned, completed, and overdue-open tasks by day.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    <span className="badge badge-primary badge-outline">Assigned</span>
                    <span className="badge badge-success badge-outline">Completed</span>
                    <span className="badge badge-error badge-outline">Overdue</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[820px] w-full">
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = height - padding - ratio * (height - padding * 2);

                        return (
                            <g key={ratio}>
                                <line
                                    x1={padding}
                                    y1={y}
                                    x2={width - padding}
                                    y2={y}
                                    stroke="currentColor"
                                    className="text-base-300"
                                    strokeWidth="1"
                                />
                                <text
                                    x="4"
                                    y={y + 4}
                                    className="fill-current text-[10px] text-base-content/50"
                                >
                                    {Math.round(maxY * ratio)}
                                </text>
                            </g>
                        );
                    })}

                    <polyline
                        points={toPolyline('assigned')}
                        fill="none"
                        stroke="currentColor"
                        className="text-primary"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    <polyline
                        points={toPolyline('completed')}
                        fill="none"
                        stroke="currentColor"
                        className="text-success"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    <polyline
                        points={toPolyline('overdueOpen')}
                        fill="none"
                        stroke="currentColor"
                        className="text-error"
                        strokeWidth="3"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />

                    {rows.map((item, index) => (
                        <g key={item.date}>
                            <circle
                                cx={padding + index * stepX}
                                cy={height - padding - (item.completed / maxY) * (height - padding * 2)}
                                r="3"
                                className="fill-success"
                            />
                        </g>
                    ))}

                    {xLabels.map((item) => {
                        const index = rows.findIndex((row) => row.date === item.date);

                        return (
                            <text
                                key={item.date}
                                x={padding + index * stepX}
                                y={height - 8}
                                textAnchor="middle"
                                className="fill-current text-[10px] text-base-content/50"
                            >
                                {item.date.slice(5)}
                            </text>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

function DonutChart({ title, distribution }: { title: string; distribution: Distribution }) {
    const rows = distributionToRows(distribution);
    const total = rows.reduce((sum, item) => sum + item.value, 0);
    let currentOffset = 25;
    const radius = 42;
    const circumference = 2 * Math.PI * radius;

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-base-content/60">
                Distribution across current period.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-[160px_1fr] md:items-center">
                <div className="relative mx-auto h-40 w-40">
                    <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke="currentColor"
                            className="text-base-300"
                            strokeWidth="18"
                        />

                        {rows.map((item, index) => {
                            const dash = total > 0 ? (item.value / total) * circumference : 0;

                            const segment = (
                                <circle
                                    key={item.label}
                                    cx="60"
                                    cy="60"
                                    r={radius}
                                    fill="none"
                                    stroke="currentColor"
                                    className={
                                        ['text-primary', 'text-success', 'text-warning', 'text-error', 'text-info', 'text-accent'][
                                        index % 6
                                        ]
                                    }
                                    strokeWidth="18"
                                    strokeDasharray={`${dash} ${circumference - dash}`}
                                    strokeDashoffset={currentOffset}
                                />
                            );

                            currentOffset -= dash;
                            return segment;
                        })}
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className="text-2xl font-black">{total}</div>
                        <div className="text-xs text-base-content/50">tasks</div>
                    </div>
                </div>

                <div className="space-y-3">
                    {rows.map((item, index) => (
                        <div key={item.label}>
                            <div className="mb-1 flex items-center justify-between text-sm">
                                <span className="font-medium">{humanize(item.label)}</span>
                                <span className="text-base-content/60">
                                    {item.value} · {total ? formatNumber((item.value / total) * 100, 1) : 0}%
                                </span>
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-base-300">
                                <div
                                    className={
                                        [
                                            'h-full rounded-full bg-primary',
                                            'h-full rounded-full bg-success',
                                            'h-full rounded-full bg-warning',
                                            'h-full rounded-full bg-error',
                                            'h-full rounded-full bg-info',
                                            'h-full rounded-full bg-accent',
                                        ][index % 6]
                                    }
                                    style={{ width: `${total ? (item.value / total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    ))}

                    {rows.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-base-300 p-5 text-center text-sm text-base-content/50">
                            No distribution data.
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

function HorizontalDistributionChart({
    title,
    distribution,
}: {
    title: string;
    distribution: Distribution;
}) {
    const rows = distributionToRows(distribution).slice(0, 12);
    const max = getMaxValue(rows.map((item) => item.value));

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-1 text-sm text-base-content/60">
                Most common categories in assigned work.
            </p>

            <div className="mt-5 space-y-3">
                {rows.map((item) => (
                    <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                            <span className="truncate font-medium">{humanize(item.label)}</span>
                            <span className="text-base-content/60">{item.value}</span>
                        </div>

                        <div className="h-3 overflow-hidden rounded-full bg-base-300">
                            <div
                                className="h-full rounded-full bg-info"
                                style={{ width: `${(item.value / max) * 100}%` }}
                            />
                        </div>
                    </div>
                ))}

                {rows.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-base-300 p-5 text-center text-sm text-base-content/50">
                        No category data.
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function WorkloadChart({ data }: { data: WorkloadPoint[] }) {
    const rows = data.slice(0, 12);
    const max = getMaxValue(
        rows.map((item) => Math.max(item.estimatedMinutes, item.capacityMinutes, item.completedMinutes))
    );

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h2 className="text-lg font-bold">Capacity vs workload</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                        Compares planned workload, completed work, and employee capacity in minutes.
                    </p>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                    <span className="badge badge-primary badge-outline">Capacity</span>
                    <span className="badge badge-warning badge-outline">Estimated</span>
                    <span className="badge badge-success badge-outline">Completed</span>
                </div>
            </div>

            <div className="space-y-5">
                {rows.map((item) => (
                    <div key={item.employeeId}>
                        <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-semibold">{item.employeeName}</span>
                            <span className="text-base-content/60">
                                {formatMinutes(item.completedMinutes)} / {formatMinutes(item.capacityMinutes)}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="h-2 overflow-hidden rounded-full bg-base-300">
                                <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${(item.capacityMinutes / max) * 100}%` }}
                                />
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-base-300">
                                <div
                                    className="h-full rounded-full bg-warning"
                                    style={{ width: `${(item.estimatedMinutes / max) * 100}%` }}
                                />
                            </div>

                            <div className="h-2 overflow-hidden rounded-full bg-base-300">
                                <div
                                    className="h-full rounded-full bg-success"
                                    style={{ width: `${(item.completedMinutes / max) * 100}%` }}
                                />
                            </div>
                        </div>

                        <div className="mt-1 grid grid-cols-4 gap-2 text-xs text-base-content/50">
                            <span>Assigned {item.assignedTasks}</span>
                            <span>Done {item.completedTasks}</span>
                            <span>Progress {item.inProgressTasks}</span>
                            <span>Overdue {item.overdueOpenTasks}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EmployeeDetailCard({ metric }: { metric: EmployeeProductivity }) {
    const employee = metric.employee;

    return (
        <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-bold">{employee.displayName}</h3>

                        <span className="badge badge-ghost">@{employee.username}</span>

                        <span className="badge badge-info badge-outline">
                            {humanize(employee.role)}
                        </span>

                        <span className={`badge badge-outline ${getScoreBadgeClass(metric.rates.productivityScore)}`}>
                            Score {formatNumber(metric.rates.productivityScore, 1)}%
                        </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {employee.skills.length ? (
                            employee.skills.map((skill) => (
                                <span key={skill} className="badge badge-ghost">
                                    {humanize(skill)}
                                </span>
                            ))
                        ) : (
                            <span className="badge badge-warning badge-outline">
                                No skills configured
                            </span>
                        )}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
                        <KpiCard label="Assigned" value={metric.totals.assignedTasks} />
                        <KpiCard label="Completed" value={metric.totals.completedTasks} tone="success" />
                        <KpiCard label="Open" value={metric.totals.openTasks} />
                        <KpiCard label="In progress" value={metric.totals.inProgressTasks} tone="info" />
                        <KpiCard label="Overdue" value={metric.totals.overdueOpenTasks} tone="error" />
                        <KpiCard label="Completed min" value={formatMinutes(metric.totals.completedMinutes)} tone="success" />
                        <KpiCard label="Capacity" value={formatMinutes(employee.capacityMinutes)} tone="primary" />
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <ProgressBar label="Completion rate" value={metric.rates.completionRate} />
                        <ProgressBar label="On-time rate" value={metric.rates.onTimeRate} />
                        <ProgressBar label="Time accuracy" value={metric.rates.timeAccuracyRate} />
                        <ProgressBar label="Productive utilization" value={metric.rates.productiveUtilizationRate} />
                    </div>
                </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-bold">Recent completed tasks</h4>
                        <span className="badge badge-success badge-outline">
                            {metric.recentCompleted.length}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {metric.recentCompleted.slice(0, 5).map((task) => (
                            <div key={task._id} className="rounded-2xl bg-base-100 p-3">
                                <div className="font-medium">{task.title}</div>

                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-base-content/50">
                                    <span>{humanize(task.type)}</span>
                                    <span>{task.store?.name || 'No store'}</span>
                                    <span>{formatDateTime(task.completedAt)}</span>
                                    <span>{formatMinutes(task.completedMinutes)}</span>
                                </div>
                            </div>
                        ))}

                        {!metric.recentCompleted.length ? (
                            <div className="rounded-2xl border border-dashed border-base-300 p-5 text-center text-sm text-base-content/50">
                                No completed tasks in this period.
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-200/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="font-bold">Open overdue tasks</h4>
                        <span className="badge badge-error badge-outline">
                            {metric.overdueTasks.length}
                        </span>
                    </div>

                    <div className="space-y-3">
                        {metric.overdueTasks.slice(0, 5).map((task) => (
                            <div key={task._id} className="rounded-2xl bg-base-100 p-3">
                                <div className="font-medium">{task.title}</div>

                                <div className="mt-1 flex flex-wrap gap-2 text-xs text-base-content/50">
                                    <span>{humanize(task.status)}</span>
                                    <span>{humanize(task.priority)}</span>
                                    <span>{task.store?.name || 'No store'}</span>
                                    <span>Due {formatDateTime(task.dueAt)}</span>
                                </div>
                            </div>
                        ))}

                        {!metric.overdueTasks.length ? (
                            <div className="rounded-2xl border border-dashed border-base-300 p-5 text-center text-sm text-base-content/50">
                                No overdue open tasks in this period.
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}

function EmployeeProductivityPage() {
    const [start, setStart] = useState(defaultStartDate());
    const [end, setEnd] = useState(defaultEndDate());
    const [employeeId, setEmployeeId] = useState('all');
    const [report, setReport] = useState<ProductivityReport | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedEmployeeId, setExpandedEmployeeId] = useState('all');

    const employeeOptions = useMemo(() => buildEmployeeOptions(report), [report]);

    const visibleEmployees = useMemo(() => {
        if (!report) return [];
        if (expandedEmployeeId === 'all') return report.employees;

        return report.employees.filter((item) => item.employee._id === expandedEmployeeId);
    }, [report, expandedEmployeeId]);

    const selectedEmployeeLabel = useMemo(() => {
        if (employeeId === 'all') return 'All employees';

        return employeeOptions.find((item) => item.value === employeeId)?.label || 'Selected employee';
    }, [employeeId, employeeOptions]);

    const loadReport = async () => {
        try {
            setIsLoading(true);

            const response = await api.get('/employee-productivity', {
                params: {
                    start,
                    end,
                    employeeId,
                },
            });

            setReport(response?.data?.data || null);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to load employee productivity report.'));
            setReport(null);
        } finally {
            setIsLoading(false);
        }
    };

    const applyRangePreset = (days: number) => {
        setStart(toDateInput(addDays(new Date(), -days + 1)));
        setEnd(defaultEndDate());
    };

    useEffect(() => {
        const cached = window.localStorage.getItem(FILTER_STORAGE_KEY);
        if (!cached) return;

        try {
            const parsed = JSON.parse(cached);
            if (parsed.start) setStart(parsed.start);
            if (parsed.end) setEnd(parsed.end);
            if (parsed.employeeId) setEmployeeId(parsed.employeeId);
        } catch {
            window.localStorage.removeItem(FILTER_STORAGE_KEY);
        }
    }, []);

    useEffect(() => {
        window.localStorage.setItem(
            FILTER_STORAGE_KEY,
            JSON.stringify({ start, end, employeeId })
        );

        loadReport();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [start, end, employeeId]);

    return (
        <DashboardLayout>
            <Head>
                <title>Employee Productivity | Marketing Assistant Panel</title>
            </Head>

            <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
                <div className="mx-auto max-w-[1600px] space-y-6 px-4 md:px-6">
                    <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
                        <div className="border-b border-base-300 p-5 md:p-7">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-2xl font-bold text-base-content md:text-3xl">
                                            Employee Productivity
                                        </h1>

                                        <span className="badge badge-primary badge-outline">
                                            Charts
                                        </span>

                                        <span className="badge badge-success badge-outline">
                                            CRM Tasks
                                        </span>
                                    </div>

                                    <p className="mt-2 max-w-4xl text-sm leading-6 text-base-content/70">
                                        Track employee productivity using accepted CRM tasks, completion behavior,
                                        overdue pressure, workload utilization, time accuracy, and daily performance trends.
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-end gap-2">
                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => applyRangePreset(7)}>
                                        7 days
                                    </button>

                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => applyRangePreset(30)}>
                                        30 days
                                    </button>

                                    <button type="button" className="btn btn-outline btn-sm" onClick={() => applyRangePreset(90)}>
                                        90 days
                                    </button>

                                    <button type="button" className="btn btn-primary btn-sm" onClick={loadReport}>
                                        Refresh
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 rounded-3xl border border-base-300 bg-base-200/40 p-4">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Start date</span>
                                        </label>

                                        <input
                                            type="date"
                                            className="input input-bordered bg-base-100"
                                            value={start}
                                            onChange={(event) => setStart(event.target.value)}
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">End date</span>
                                        </label>

                                        <input
                                            type="date"
                                            className="input input-bordered bg-base-100"
                                            value={end}
                                            onChange={(event) => setEnd(event.target.value)}
                                        />
                                    </div>

                                    <div className="form-control">
                                        <label className="label">
                                            <span className="label-text">Employee</span>
                                        </label>

                                        <select
                                            className="select select-bordered bg-base-100"
                                            value={employeeId}
                                            onChange={(event) => setEmployeeId(event.target.value)}
                                        >
                                            <option value="all">All employees</option>

                                            {employeeOptions.map((employee) => (
                                                <option key={employee.value} value={employee.value}>
                                                    {employee.label} · {employee.meta}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                        <div className="text-xs text-base-content/50">Currently showing</div>
                                        <div className="mt-1 font-bold">{selectedEmployeeLabel}</div>
                                        <div className="mt-1 text-xs text-base-content/60">
                                            {formatDate(start)} → {formatDate(end)}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
                                <KpiCard label="Employees" value={report?.summary.employees || 0} tone="info" />
                                <KpiCard label="Assigned" value={report?.summary.assignedTasks || 0} />
                                <KpiCard label="Completed" value={report?.summary.completedTasks || 0} tone="success" />
                                <KpiCard label="Open" value={report?.summary.openTasks || 0} />
                                <KpiCard label="In progress" value={report?.summary.inProgressTasks || 0} tone="primary" />
                                <KpiCard label="Overdue" value={report?.summary.overdueOpenTasks || 0} tone="error" />
                                <KpiCard
                                    label="Avg score"
                                    value={`${formatNumber(report?.summary.averageProductivityScore || 0, 1)}%`}
                                    tone="warning"
                                />
                                <KpiCard label="Done time" value={formatMinutes(report?.summary.completedMinutes || 0)} tone="success" />
                            </div>
                        </div>

                        <div className="space-y-6 p-5 md:p-7">
                            {isLoading ? (
                                <div className="flex min-h-[420px] items-center justify-center">
                                    <span className="loading loading-spinner loading-lg text-primary" />
                                </div>
                            ) : !report ? (
                                <div className="rounded-3xl border border-dashed border-base-300 bg-base-200/40 px-6 py-16 text-center">
                                    <div className="text-4xl">📊</div>
                                    <h3 className="mt-3 text-lg font-semibold">No productivity data loaded</h3>
                                    <p className="mt-2 text-sm text-base-content/60">
                                        Refresh the report or check the API response.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {report.insights.length > 0 ? (
                                        <div className="grid grid-cols-1 gap-3 xl:grid-cols-4">
                                            {report.insights.map((insight) => (
                                                <div
                                                    key={`${insight.type}-${insight.employeeId || 'team'}`}
                                                    className={`rounded-3xl border p-4 ${getSeverityClass(insight.severity)}`}
                                                >
                                                    <div className="font-bold">{insight.title}</div>
                                                    <p className="mt-2 text-sm leading-6 text-base-content/70">
                                                        {insight.description}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                                        <LeaderboardBarChart data={report.charts.leaderboard} />
                                        <WorkloadChart data={report.charts.workloadByEmployee} />
                                    </div>

                                    <DailyTrendChart data={report.charts.dailySeries} />

                                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                                        <DonutChart title="Status distribution" distribution={report.charts.distributions.status} />
                                        <HorizontalDistributionChart title="Task types" distribution={report.charts.distributions.type} />
                                        <HorizontalDistributionChart title="Task sources" distribution={report.charts.distributions.source} />
                                    </div>

                                    <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                                        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <h2 className="text-lg font-bold">Employee details</h2>
                                                <p className="mt-1 text-sm text-base-content/60">
                                                    Complete productivity breakdown per employee with recent completed work and overdue risk.
                                                </p>
                                            </div>

                                            <select
                                                className="select select-bordered bg-base-100"
                                                value={expandedEmployeeId}
                                                onChange={(event) => setExpandedEmployeeId(event.target.value)}
                                            >
                                                <option value="all">Show all employees</option>

                                                {employeeOptions.map((employee) => (
                                                    <option key={employee.value} value={employee.value}>
                                                        {employee.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-5">
                                            {visibleEmployees.map((metric) => (
                                                <EmployeeDetailCard key={metric.employee._id} metric={metric} />
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export const getServerSideProps = withAuth();

export default dynamic(() => Promise.resolve(EmployeeProductivityPage), {
    ssr: false,
});