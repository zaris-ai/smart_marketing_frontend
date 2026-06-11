// pages/dashboard/daily-planner.tsx

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
  contactEmail?: string;
  crm?: StoreCrm;
};

type AssignedUser = {
  _id: string;
  username: string;
  marketingProfile?: {
    displayName?: string;
    role?: string;
    skills?: string[];
  };
};

type ConvertedTask = {
  _id?: string;
  title?: string;
  status?: string;
  dueAt?: string;
};

type PlannerSuggestion = {
  _id: string;
  storeId?: StoreLead | string | null;
  assignedTo?: AssignedUser | string | null;
  title: string;
  description?: string;
  reason?: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  suggestedForDate: string;
  suggestedDueAt?: string | null;
  estimatedMinutes: number;
  score: number;
  confidence: number;
  sourceRule?: string;
  status: 'suggested' | 'dismissed' | 'snoozed' | 'converted';
  convertedTaskId?: ConvertedTask | string | null;
  dismissedReason?: string;
  snoozedUntil?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PlannerGroup = {
  date: string;
  suggestions: PlannerSuggestion[];
  summary: {
    total: number;
    suggested: number;
    converted: number;
    dismissed: number;
    snoozed: number;
  };
};

type SuggestionsResponse = {
  dates: string[];
  grouped: PlannerGroup[];
  total: number;
};

type GenerateResult = {
  date: string;
  totalCandidates?: number;
  eligibleCandidates?: number;
  assignedCandidates?: number;
  generatedSuggestions?: number;
  cleanup?: {
    deletedTasks?: number;
    deletedSuggestions?: number;
  };
  warning?: string;
};

type LastGeneration = {
  totalGenerated: number;
  totalSuggestions: number;
  results: GenerateResult[];
};

type StatusFilter = 'all' | 'suggested' | 'converted' | 'snoozed' | 'dismissed';
type PriorityFilter = 'all' | 'high' | 'medium' | 'low';

type PlannerFilters = {
  employeeId: string;
  status: StatusFilter;
  priority: PriorityFilter;
  type: string;
  stage: string;
  search: string;
};

type SelectOption = {
  value: string;
  label: string;
  meta?: string;
};

const EMPTY_GROUP_SUMMARY = {
  total: 0,
  suggested: 0,
  converted: 0,
  dismissed: 0,
  snoozed: 0,
};

const DEFAULT_FILTERS: PlannerFilters = {
  employeeId: 'all',
  status: 'all',
  priority: 'all',
  type: 'all',
  stage: 'all',
  search: '',
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'suggested', label: 'Needs approval' },
  { value: 'converted', label: 'Approved / Task created' },
  { value: 'snoozed', label: 'Snoozed' },
  { value: 'dismissed', label: 'Dismissed' },
];

const PRIORITY_OPTIONS: Array<{ value: PriorityFilter; label: string }> = [
  { value: 'all', label: 'All priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

function toDateInput(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDaysInput(value: string, days: number) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  date.setDate(date.getDate() + days);

  return toDateInput(date);
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

function formatTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isStoreObject(store: PlannerSuggestion['storeId']): store is StoreLead {
  return Boolean(store && typeof store === 'object' && '_id' in store);
}

function getStoreId(store: PlannerSuggestion['storeId']) {
  if (!store) return '';
  if (typeof store === 'string') return store;

  return store._id || '';
}

function getStoreName(store: PlannerSuggestion['storeId']) {
  if (!store) return 'Unknown store';
  if (typeof store === 'string') return 'Store';

  return store.name || store.domain || 'Unknown store';
}

function getStoreDomain(store: PlannerSuggestion['storeId']) {
  if (!store || typeof store === 'string') return '';

  return store.domain || '';
}

function getStoreEmail(store: PlannerSuggestion['storeId']) {
  if (!store || typeof store === 'string') return '';

  return store.contactEmail || '';
}

function getCrm(store: PlannerSuggestion['storeId']): StoreCrm {
  if (!isStoreObject(store)) return {};

  return store.crm || {};
}

function getEmployeeId(user: PlannerSuggestion['assignedTo']) {
  if (!user) return 'unassigned';
  if (typeof user === 'string') return user || 'unassigned';

  return user._id || 'unassigned';
}

function getEmployeeName(user: PlannerSuggestion['assignedTo']) {
  if (!user) return 'Unassigned';
  if (typeof user === 'string') return 'Assigned employee';

  return user.marketingProfile?.displayName || user.username || 'Assigned employee';
}

function getEmployeeRole(user: PlannerSuggestion['assignedTo']) {
  if (!user || typeof user === 'string') return 'employee';

  return user.marketingProfile?.role || 'employee';
}

function getPriorityClass(priority?: string) {
  if (priority === 'high') return 'badge-error';
  if (priority === 'low') return 'badge-ghost';

  return 'badge-warning';
}

function getStatusClass(status?: string) {
  if (status === 'converted') return 'badge-success';
  if (status === 'dismissed') return 'badge-error';
  if (status === 'snoozed') return 'badge-warning';

  return 'badge-primary';
}

function getStatusLabel(status?: string) {
  if (status === 'suggested') return 'Needs approval';
  if (status === 'converted') return 'Task created';
  if (status === 'dismissed') return 'Dismissed';
  if (status === 'snoozed') return 'Snoozed';

  return humanize(status);
}

function getStageClass(stage?: string) {
  if (['won', 'activated'].includes(stage || '')) return 'badge-success';
  if (stage === 'lost') return 'badge-error';
  if (['contacted', 'engaged', 'installed'].includes(stage || '')) return 'badge-info';
  if (stage === 'qualified') return 'badge-primary';

  return 'badge-ghost';
}

function getConvertedTaskId(task: PlannerSuggestion['convertedTaskId']) {
  if (!task) return '';
  if (typeof task === 'string') return task;

  return task._id || '';
}

function getTotalMinutes(items: PlannerSuggestion[]) {
  return items.reduce((sum, item) => sum + Number(item.estimatedMinutes || 0), 0);
}

function getGroupSummary(suggestions: PlannerSuggestion[] = []) {
  return {
    total: suggestions.length,
    suggested: suggestions.filter((item) => item.status === 'suggested').length,
    converted: suggestions.filter((item) => item.status === 'converted').length,
    dismissed: suggestions.filter((item) => item.status === 'dismissed').length,
    snoozed: suggestions.filter((item) => item.status === 'snoozed').length,
  };
}

function normalizeGroup(group: any, fallbackDate: string): PlannerGroup {
  const suggestions = Array.isArray(group?.suggestions) ? group.suggestions : [];

  return {
    date: group?.date || fallbackDate,
    suggestions,
    summary: group?.summary || getGroupSummary(suggestions),
  };
}

function normalizeSuggestionsResponse(raw: any, selectedDate: string): SuggestionsResponse {
  const data = raw?.data?.data || raw?.data || raw || {};

  if (Array.isArray(data.grouped)) {
    const group = normalizeGroup(data.grouped[0], selectedDate);

    return {
      dates: data.dates || [selectedDate],
      grouped: [group],
      total: Number(data.total || group.suggestions.length || 0),
    };
  }

  if (Array.isArray(data.suggestions)) {
    const suggestions = data.suggestions as PlannerSuggestion[];

    return {
      dates: [data.date || selectedDate],
      grouped: [
        {
          date: data.date || selectedDate,
          suggestions,
          summary: data.summary || getGroupSummary(suggestions),
        },
      ],
      total: suggestions.length,
    };
  }

  return {
    dates: [selectedDate],
    grouped: [
      {
        date: selectedDate,
        suggestions: [],
        summary: EMPTY_GROUP_SUMMARY,
      },
    ],
    total: 0,
  };
}

function normalizeGenerationResponse(raw: any): LastGeneration {
  const data = raw?.data?.data || raw?.data || raw || {};

  return {
    totalGenerated: Number(data.totalGenerated || data.totalSuggestions || 0),
    totalSuggestions: Number(data.totalSuggestions || data.totalGenerated || 0),
    results: Array.isArray(data.results) ? data.results : [],
  };
}

function sortSuggestions(items: PlannerSuggestion[]) {
  const statusWeight: Record<string, number> = {
    suggested: 4,
    snoozed: 3,
    converted: 2,
    dismissed: 1,
  };

  const priorityWeight: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...items].sort((a, b) => {
    const aStatus = statusWeight[a.status] || 0;
    const bStatus = statusWeight[b.status] || 0;

    if (aStatus !== bStatus) return bStatus - aStatus;

    const aPriority = priorityWeight[a.priority] || 0;
    const bPriority = priorityWeight[b.priority] || 0;

    if (aPriority !== bPriority) return bPriority - aPriority;

    if ((a.score || 0) !== (b.score || 0)) return (b.score || 0) - (a.score || 0);

    const aDue = a.suggestedDueAt ? new Date(a.suggestedDueAt).getTime() : 0;
    const bDue = b.suggestedDueAt ? new Date(b.suggestedDueAt).getTime() : 0;

    return aDue - bDue;
  });
}

function getSuggestionStage(suggestion: PlannerSuggestion) {
  const crm = getCrm(suggestion.storeId);

  return crm.funnelStage || 'unknown';
}

function getSuggestionSearchText(suggestion: PlannerSuggestion) {
  const crm = getCrm(suggestion.storeId);

  return [
    suggestion.title,
    suggestion.description,
    suggestion.reason,
    suggestion.type,
    suggestion.priority,
    suggestion.status,
    suggestion.sourceRule,
    getStoreName(suggestion.storeId),
    getStoreDomain(suggestion.storeId),
    getStoreEmail(suggestion.storeId),
    crm.funnelStage,
    crm.leadStatus,
    crm.priority,
    crm.painAngle,
    crm.fitScore,
    getEmployeeName(suggestion.assignedTo),
    getEmployeeRole(suggestion.assignedTo),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function suggestionMatchesFilters(suggestion: PlannerSuggestion, filters: PlannerFilters) {
  if (filters.employeeId !== 'all' && getEmployeeId(suggestion.assignedTo) !== filters.employeeId) {
    return false;
  }

  if (filters.status !== 'all' && suggestion.status !== filters.status) {
    return false;
  }

  if (filters.priority !== 'all' && suggestion.priority !== filters.priority) {
    return false;
  }

  if (filters.type !== 'all' && suggestion.type !== filters.type) {
    return false;
  }

  if (filters.stage !== 'all' && getSuggestionStage(suggestion) !== filters.stage) {
    return false;
  }

  const query = filters.search.trim().toLowerCase();

  if (query && !getSuggestionSearchText(suggestion).includes(query)) {
    return false;
  }

  return true;
}

function buildEmployeeOptions(suggestions: PlannerSuggestion[]): SelectOption[] {
  const map = new Map<string, SelectOption>();

  suggestions.forEach((suggestion) => {
    const id = getEmployeeId(suggestion.assignedTo);
    const label = getEmployeeName(suggestion.assignedTo);
    const role = getEmployeeRole(suggestion.assignedTo);

    if (!id) return;

    if (!map.has(id)) {
      map.set(id, {
        value: id,
        label,
        meta: humanize(role),
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function buildTypeOptions(suggestions: PlannerSuggestion[]): SelectOption[] {
  const types = new Set<string>();

  suggestions.forEach((suggestion) => {
    if (suggestion.type) types.add(suggestion.type);
  });

  return Array.from(types)
    .sort()
    .map((type) => ({
      value: type,
      label: humanize(type),
    }));
}

function buildStageOptions(suggestions: PlannerSuggestion[]): SelectOption[] {
  const stages = new Set<string>();

  suggestions.forEach((suggestion) => {
    const stage = getSuggestionStage(suggestion);
    if (stage) stages.add(stage);
  });

  return Array.from(stages)
    .sort()
    .map((stage) => ({
      value: stage,
      label: humanize(stage),
    }));
}

function getSelectedEmployeeLabel(filters: PlannerFilters, employeeOptions: SelectOption[]) {
  if (filters.employeeId === 'all') return 'All employees';

  const employee = employeeOptions.find((item) => item.value === filters.employeeId);

  return employee?.label || 'Selected employee';
}

function getEmployeeBreakdown(suggestions: PlannerSuggestion[]) {
  const map = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      role: string;
      total: number;
      pending: number;
      converted: number;
      minutes: number;
    }
  >();

  suggestions.forEach((suggestion) => {
    const employeeId = getEmployeeId(suggestion.assignedTo);
    const employeeName = getEmployeeName(suggestion.assignedTo);
    const role = getEmployeeRole(suggestion.assignedTo);

    if (!map.has(employeeId)) {
      map.set(employeeId, {
        employeeId,
        employeeName,
        role,
        total: 0,
        pending: 0,
        converted: 0,
        minutes: 0,
      });
    }

    const item = map.get(employeeId);

    if (!item) return;

    item.total += 1;

    if (suggestion.status === 'suggested') {
      item.pending += 1;
      item.minutes += Number(suggestion.estimatedMinutes || 0);
    }

    if (suggestion.status === 'converted') {
      item.converted += 1;
    }
  });

  return Array.from(map.values()).sort((a, b) => b.pending - a.pending || b.total - a.total);
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-control w-full">
      <span className="label-text mb-1 font-medium">{label}</span>
      <select
        className="select select-bordered w-full bg-base-100"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
            {option.meta ? ` · ${option.meta}` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'base',
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'base' | 'primary' | 'success' | 'warning' | 'error' | 'info';
}) {
  const toneClass =
    tone === 'primary'
      ? 'border-primary/20 bg-primary/5 text-primary'
      : tone === 'success'
        ? 'border-success/20 bg-success/5 text-success'
        : tone === 'warning'
          ? 'border-warning/20 bg-warning/5 text-warning'
          : tone === 'error'
            ? 'border-error/20 bg-error/5 text-error'
            : tone === 'info'
              ? 'border-info/20 bg-info/5 text-info'
              : 'border-base-300 bg-base-100 text-base-content';

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-70">{label}</div>
      <div className="mt-2 text-3xl font-black">{value}</div>
      {hint ? <div className="mt-1 text-xs opacity-70">{hint}</div> : null}
    </div>
  );
}

function SuggestionCard({
  suggestion,
  actingId,
  onAccept,
  onDismiss,
  onSnooze,
}: {
  suggestion: PlannerSuggestion;
  actingId: string;
  onAccept: (suggestion: PlannerSuggestion) => Promise<void>;
  onDismiss: (suggestion: PlannerSuggestion) => Promise<void>;
  onSnooze: (suggestion: PlannerSuggestion) => Promise<void>;
}) {
  const storeId = getStoreId(suggestion.storeId);
  const crm = getCrm(suggestion.storeId);
  const isActing = actingId === suggestion._id;
  const isPending = suggestion.status === 'suggested';
  const convertedTaskId = getConvertedTaskId(suggestion.convertedTaskId);

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${getPriorityClass(suggestion.priority)}`}>
              {humanize(suggestion.priority)}
            </span>

            <span className={`badge ${getStatusClass(suggestion.status)}`}>
              {getStatusLabel(suggestion.status)}
            </span>

            <span className="badge badge-outline">{humanize(suggestion.type)}</span>

            <span className="badge badge-ghost">{suggestion.estimatedMinutes || 0} min</span>

            <span className="badge badge-outline">Score {suggestion.score || 0}</span>
          </div>

          <h3 className="mt-3 text-lg font-black text-base-content">{suggestion.title}</h3>

          {suggestion.description ? (
            <p className="mt-2 text-sm leading-6 text-base-content/70">
              {suggestion.description}
            </p>
          ) : null}

          {suggestion.reason ? (
            <div className="mt-3 rounded-2xl border border-info/20 bg-info/5 p-3 text-sm leading-6 text-base-content/75">
              <span className="font-bold text-info">Reason: </span>
              {suggestion.reason}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-base-200/60 p-3">
              <div className="text-xs text-base-content/50">Employee</div>
              <div className="mt-1 font-bold">{getEmployeeName(suggestion.assignedTo)}</div>
              <div className="mt-1 text-xs text-base-content/50">
                {humanize(getEmployeeRole(suggestion.assignedTo))}
              </div>
            </div>

            <div className="rounded-2xl bg-base-200/60 p-3">
              <div className="text-xs text-base-content/50">Suggested time</div>
              <div className="mt-1 font-bold">{formatDateTime(suggestion.suggestedDueAt)}</div>
            </div>

            <div className="rounded-2xl bg-base-200/60 p-3">
              <div className="text-xs text-base-content/50">Source rule</div>
              <div className="mt-1 font-bold">{humanize(suggestion.sourceRule)}</div>
            </div>

            <div className="rounded-2xl bg-base-200/60 p-3">
              <div className="text-xs text-base-content/50">Created task</div>
              <div className="mt-1 truncate font-bold">{convertedTaskId || '-'}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-base-300 bg-base-200/40 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs text-base-content/50">Store</div>
                <div className="mt-1 text-base font-black">{getStoreName(suggestion.storeId)}</div>

                <div className="mt-1 flex flex-wrap gap-3 text-xs text-base-content/60">
                  {getStoreDomain(suggestion.storeId) ? (
                    <span>{getStoreDomain(suggestion.storeId)}</span>
                  ) : null}

                  {getStoreEmail(suggestion.storeId) ? (
                    <span>{getStoreEmail(suggestion.storeId)}</span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`badge ${getStageClass(crm.funnelStage)}`}>
                  {humanize(crm.funnelStage || 'unknown')}
                </span>
                <span className="badge badge-outline">{humanize(crm.leadStatus || 'new')}</span>
                <span className="badge badge-ghost">Fit {crm.fitScore || 0}</span>
                <span className="badge badge-outline">{humanize(crm.painAngle || 'unknown')}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2 xl:w-56">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-center">
            <div className="text-xs font-medium text-primary/70">Due time</div>
            <div className="mt-1 text-xl font-black text-primary">
              {formatTime(suggestion.suggestedDueAt)}
            </div>
          </div>

          {isPending ? (
            <>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => onAccept(suggestion)}
                disabled={isActing}
              >
                {isActing ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Approving
                  </>
                ) : (
                  'Approve & Create Task'
                )}
              </button>

              <button
                type="button"
                className="btn btn-warning btn-outline btn-sm"
                onClick={() => onSnooze(suggestion)}
                disabled={isActing}
              >
                Snooze
              </button>

              <button
                type="button"
                className="btn btn-error btn-outline btn-sm"
                onClick={() => onDismiss(suggestion)}
                disabled={isActing}
              >
                Dismiss
              </button>
            </>
          ) : (
            <div className="rounded-2xl border border-base-300 bg-base-200/50 p-3 text-center text-sm text-base-content/70">
              {suggestion.status === 'converted'
                ? 'This suggestion was already approved.'
                : `Current status: ${getStatusLabel(suggestion.status)}`}
            </div>
          )}

          {storeId ? (
            <Link href={`/dashboard/stores/${storeId}/crm`} className="btn btn-ghost btn-sm">
              Open Store CRM
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function EmployeeBreakdown({
  employees,
}: {
  employees: ReturnType<typeof getEmployeeBreakdown>;
}) {
  if (!employees.length) {
    return null;
  }

  return (
    <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-black">Employee workload</h2>
        <p className="mt-1 text-sm text-base-content/60">
          Today-only suggested workload by employee.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {employees.map((employee) => (
          <div
            key={employee.employeeId}
            className="rounded-2xl border border-base-300 bg-base-200/40 p-4"
          >
            <div className="font-bold">{employee.employeeName}</div>
            <div className="mt-1 text-xs text-base-content/50">{humanize(employee.role)}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-primary">Pending {employee.pending}</span>
              <span className="badge badge-success">Approved {employee.converted}</span>
              <span className="badge badge-outline">{employee.minutes}m</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyPlannerPage() {
  const [selectedDate] = useState(toDateInput());
  const [data, setData] = useState<SuggestionsResponse | null>(null);
  const [lastGeneration, setLastGeneration] = useState<LastGeneration | null>(null);
  const [filters, setFilters] = useState<PlannerFilters>(DEFAULT_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [actingId, setActingId] = useState('');

  const todayGroup = data?.grouped?.[0] || {
    date: selectedDate,
    suggestions: [],
    summary: EMPTY_GROUP_SUMMARY,
  };

  const rawSuggestions = todayGroup.suggestions || [];

  const employeeOptions = useMemo(() => {
    return buildEmployeeOptions(rawSuggestions);
  }, [rawSuggestions]);

  const typeOptions = useMemo(() => {
    return buildTypeOptions(rawSuggestions);
  }, [rawSuggestions]);

  const stageOptions = useMemo(() => {
    return buildStageOptions(rawSuggestions);
  }, [rawSuggestions]);

  const employeeBreakdown = useMemo(() => {
    return getEmployeeBreakdown(rawSuggestions);
  }, [rawSuggestions]);

  const visibleSuggestions = useMemo(() => {
    return sortSuggestions(
      rawSuggestions.filter((suggestion) => suggestionMatchesFilters(suggestion, filters))
    );
  }, [rawSuggestions, filters]);

  const pendingVisibleSuggestions = useMemo(() => {
    return visibleSuggestions.filter((item) => item.status === 'suggested');
  }, [visibleSuggestions]);

  const hasActiveFilters =
    filters.employeeId !== 'all' ||
    filters.status !== 'all' ||
    filters.priority !== 'all' ||
    filters.type !== 'all' ||
    filters.stage !== 'all' ||
    Boolean(filters.search.trim());

  const selectedEmployeeLabel = getSelectedEmployeeLabel(filters, employeeOptions);

  const pageSummary = useMemo(() => {
    const pending = rawSuggestions.filter((item) => item.status === 'suggested');
    const converted = rawSuggestions.filter((item) => item.status === 'converted');
    const snoozed = rawSuggestions.filter((item) => item.status === 'snoozed');
    const dismissed = rawSuggestions.filter((item) => item.status === 'dismissed');

    return {
      total: rawSuggestions.length,
      pending: pending.length,
      converted: converted.length,
      snoozed: snoozed.length,
      dismissed: dismissed.length,
      pendingMinutes: getTotalMinutes(pending),
      employees: new Set(
        rawSuggestions.map((item) => getEmployeeId(item.assignedTo)).filter(Boolean)
      ).size,
    };
  }, [rawSuggestions]);

  const filteredSummary = useMemo(() => {
    const pending = visibleSuggestions.filter((item) => item.status === 'suggested');
    const converted = visibleSuggestions.filter((item) => item.status === 'converted');
    const snoozed = visibleSuggestions.filter((item) => item.status === 'snoozed');
    const dismissed = visibleSuggestions.filter((item) => item.status === 'dismissed');

    return {
      total: visibleSuggestions.length,
      pending: pending.length,
      converted: converted.length,
      snoozed: snoozed.length,
      dismissed: dismissed.length,
      minutes: getTotalMinutes(pending),
    };
  }, [visibleSuggestions]);

  const updateFilter = <K extends keyof PlannerFilters>(key: K, value: PlannerFilters[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const loadSuggestions = async () => {
    try {
      setIsLoading(true);

      const response = await api.get('/marketing-planner/suggestions', {
        params: {
          date: selectedDate,
        },
      });

      setData(normalizeSuggestionsResponse(response, selectedDate));
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to load today planner suggestions.'));
      setData(normalizeSuggestionsResponse(null, selectedDate));
    } finally {
      setIsLoading(false);
    }
  };

  const generateSuggestions = async () => {
    try {
      setIsGenerating(true);

      const response = await api.post('/marketing-planner/generate', {
        date: selectedDate,
        resetExisting: true,
        dueHour: 10,
      });

      const normalizedGeneration = normalizeGenerationResponse(response);
      setLastGeneration(normalizedGeneration);

      toast.success(`${normalizedGeneration.totalGenerated} suggestion(s) generated for today.`);

      await loadSuggestions();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to generate today suggestions.'));
    } finally {
      setIsGenerating(false);
    }
  };

  const acceptSuggestion = async (suggestion: PlannerSuggestion) => {
    try {
      setActingId(suggestion._id);

      await api.post(`/marketing-planner/suggestions/${suggestion._id}/accept`);

      toast.success('Suggestion approved and employee task created.');
      await loadSuggestions();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to approve suggestion.'));
    } finally {
      setActingId('');
    }
  };

  const acceptAllVisible = async () => {
    const items = pendingVisibleSuggestions;

    if (items.length === 0) {
      toast.info('There are no visible pending suggestions to approve.');
      return;
    }

    try {
      setIsAcceptingAll(true);

      let successCount = 0;
      let failCount = 0;

      for (const suggestion of items) {
        try {
          await api.post(`/marketing-planner/suggestions/${suggestion._id}/accept`);
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }

      if (successCount) {
        toast.success(`${successCount} visible suggestion(s) approved and converted into tasks.`);
      }

      if (failCount) {
        toast.warning(`${failCount} suggestion(s) could not be approved.`);
      }

      await loadSuggestions();
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const dismissSuggestion = async (suggestion: PlannerSuggestion) => {
    try {
      setActingId(suggestion._id);

      await api.post(`/marketing-planner/suggestions/${suggestion._id}/dismiss`, {
        dismissedReason: 'Dismissed from today planner UI',
      });

      toast.success('Suggestion dismissed.');
      await loadSuggestions();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to dismiss suggestion.'));
    } finally {
      setActingId('');
    }
  };

  const snoozeSuggestion = async (suggestion: PlannerSuggestion) => {
    try {
      setActingId(suggestion._id);

      await api.post(`/marketing-planner/suggestions/${suggestion._id}/snooze`, {
        snoozedUntil: addDaysInput(selectedDate, 1),
      });

      toast.success('Suggestion snoozed.');
      await loadSuggestions();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to snooze suggestion.'));
    } finally {
      setActingId('');
    }
  };

  useEffect(() => {
    loadSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  return (
    <DashboardLayout>
      <Head>
        <title>Today Planner | Marketing Assistant Panel</title>
      </Head>

      <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
        <div className="mx-auto max-w-[1500px] space-y-6 px-4 md:px-6">
          <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 p-5 md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                      Today Planner
                    </h1>

                    <span className="badge badge-primary badge-outline">Today only</span>
                    <span className="badge badge-warning badge-outline">Approval required</span>
                  </div>

                  <p className="mt-3 max-w-3xl text-sm leading-6 text-base-content/70">
                    Generate intelligent CRM suggestions only for today. Managers approve each
                    suggestion before a real employee task is created.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row xl:items-center">
                  <div className="rounded-2xl border border-base-300 bg-base-200/40 px-4 py-3">
                    <div className="text-xs text-base-content/50">Planning date</div>
                    <div className="font-black">Today · {formatDate(selectedDate)}</div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={loadSuggestions}
                    disabled={isLoading || isGenerating}
                  >
                    Refresh
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={generateSuggestions}
                    disabled={isGenerating}
                  >
                    {isGenerating ? (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        Generating
                      </>
                    ) : (
                      'Generate Today Suggestions'
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-6">
              <SummaryCard
                label="Total"
                value={pageSummary.total}
                hint="Today planner items"
                tone="base"
              />

              <SummaryCard
                label="Needs approval"
                value={pageSummary.pending}
                hint={`${pageSummary.pendingMinutes} minutes pending`}
                tone="primary"
              />

              <SummaryCard
                label="Approved"
                value={pageSummary.converted}
                hint="Tasks created"
                tone="success"
              />

              <SummaryCard
                label="Snoozed"
                value={pageSummary.snoozed}
                hint="Moved forward"
                tone="warning"
              />

              <SummaryCard
                label="Dismissed"
                value={pageSummary.dismissed}
                hint="Rejected items"
                tone="error"
              />

              <SummaryCard
                label="Employees"
                value={pageSummary.employees}
                hint="Assigned today"
                tone="info"
              />
            </div>
          </div>

          {lastGeneration ? (
            <div className="rounded-3xl border border-success/20 bg-success/5 p-5 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-black text-success">Last generation result</h2>
                  <p className="mt-1 text-sm text-base-content/70">
                    Generated {lastGeneration.totalGenerated} approval-ready suggestion(s) for
                    today.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {lastGeneration.results.map((result) => (
                    <span key={String(result.date)} className="badge badge-success badge-outline">
                      Candidates {result.totalCandidates || 0} · Eligible{' '}
                      {result.eligibleCandidates || 0} · Generated{' '}
                      {result.generatedSuggestions || 0}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-lg font-black">Filters</h2>
                <p className="mt-1 text-sm text-base-content/60">
                  Current employee scope: <span className="font-bold">{selectedEmployeeLabel}</span>
                </p>
              </div>

              <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
                Reset filters
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <FilterSelect
                label="Employee"
                value={filters.employeeId}
                options={[
                  { value: 'all', label: 'All employees' },
                  ...employeeOptions,
                ]}
                onChange={(value) => updateFilter('employeeId', value)}
              />

              <FilterSelect
                label="Status"
                value={filters.status}
                options={STATUS_OPTIONS}
                onChange={(value) => updateFilter('status', value as StatusFilter)}
              />

              <FilterSelect
                label="Priority"
                value={filters.priority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => updateFilter('priority', value as PriorityFilter)}
              />

              <FilterSelect
                label="Task type"
                value={filters.type}
                options={[
                  { value: 'all', label: 'All task types' },
                  ...typeOptions,
                ]}
                onChange={(value) => updateFilter('type', value)}
              />

              <FilterSelect
                label="CRM stage"
                value={filters.stage}
                options={[
                  { value: 'all', label: 'All CRM stages' },
                  ...stageOptions,
                ]}
                onChange={(value) => updateFilter('stage', value)}
              />

              <label className="form-control w-full">
                <span className="label-text mb-1 font-medium">Search</span>
                <input
                  className="input input-bordered w-full bg-base-100"
                  value={filters.search}
                  onChange={(event) => updateFilter('search', event.target.value)}
                  placeholder="Store, employee, task..."
                />
              </label>
            </div>
          </div>

          <EmployeeBreakdown employees={employeeBreakdown} />

          <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <h2 className="text-lg font-black">Today suggestions</h2>
                  <p className="mt-1 text-sm text-base-content/60">
                    Showing {visibleSuggestions.length} of {rawSuggestions.length} item(s).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-primary">
                    Visible pending {filteredSummary.pending}
                  </span>
                  <span className="badge badge-success">
                    Visible approved {filteredSummary.converted}
                  </span>
                  <span className="badge badge-outline">
                    Visible workload {filteredSummary.minutes}m
                  </span>

                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={acceptAllVisible}
                    disabled={isAcceptingAll || pendingVisibleSuggestions.length === 0}
                  >
                    {isAcceptingAll ? (
                      <>
                        <span className="loading loading-spinner loading-sm" />
                        Approving
                      </>
                    ) : (
                      `Approve Visible (${pendingVisibleSuggestions.length})`
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="p-5">
              {isLoading ? (
                <div className="flex min-h-64 items-center justify-center">
                  <span className="loading loading-spinner loading-lg" />
                </div>
              ) : visibleSuggestions.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-base-300 bg-base-200/40 p-10 text-center">
                  <h3 className="text-xl font-black">No today suggestions found</h3>

                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-base-content/60">
                    There are no approval-ready suggestions for today with the current filters.
                    Generate today suggestions or clear filters.
                  </p>

                  <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                    {hasActiveFilters ? (
                      <button type="button" className="btn btn-primary" onClick={resetFilters}>
                        Clear filters
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={generateSuggestions}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <>
                            <span className="loading loading-spinner loading-sm" />
                            Generating
                          </>
                        ) : (
                          'Generate Today Suggestions'
                        )}
                      </button>
                    )}

                    <Link href="/dashboard/marketing-capacity" className="btn btn-outline">
                      Check Employees
                    </Link>

                    <Link href="/dashboard/crm-funnel" className="btn btn-outline">
                      Check CRM Funnel
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleSuggestions.map((suggestion) => (
                    <SuggestionCard
                      key={suggestion._id}
                      suggestion={suggestion}
                      actingId={actingId}
                      onAccept={acceptSuggestion}
                      onDismiss={dismissSuggestion}
                      onSnooze={snoozeSuggestion}
                    />
                  ))}
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

export default dynamic(() => Promise.resolve(DailyPlannerPage), {
  ssr: false,
});