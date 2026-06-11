import { DashboardLayout } from '@/components/layouts';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

type MarketingRole =
    | 'admin'
    | 'marketing'
    | 'marketing_development'
    | 'sales'
    | 'support'
    | 'manager'
    | 'other';

type MarketingSkill =
    | 'store_research'
    | 'contact_discovery'
    | 'email_outreach'
    | 'follow_up'
    | 'install_guidance'
    | 'onboarding'
    | 'crm_review'
    | 'copywriting'
    | 'reporting';

type MarketingProfile = {
    displayName?: string;
    role?: MarketingRole;
    skills?: MarketingSkill[];
    workingHoursPerDay?: number;
    workingDays?: number[];
    efficiencyFactor?: number;
    maxTasksPerDay?: number;
    isMarketingMember?: boolean;
    notes?: string;
};

type AdminUser = {
    _id: string;
    username: string;
    marketingProfile?: MarketingProfile;
    createdAt?: string;
    updatedAt?: string;
};

type UserForm = {
    username: string;
    password: string;
    displayName: string;
    role: MarketingRole;
    skills: MarketingSkill[];
    workingHoursPerDay: number;
    workingDays: number[];
    efficiencyFactor: number;
    maxTasksPerDay: number;
    notes: string;
};

const USERS_API_BASE = '/users';
const USERS_ADMIN_API = `${USERS_API_BASE}/admins`;
const USERS_MARKETING_MEMBERS_API = `${USERS_API_BASE}/marketing-members`;

const employeeRoles: MarketingRole[] = [
    'marketing',
    'marketing_development',
    'sales',
    'support',
    'other',
];

const employeeRoleMeta: Record<
    string,
    {
        label: string;
        description: string;
        badgeClass: string;
        icon: string;
    }
> = {
    marketing: {
        label: 'Marketing',
        description: 'Campaigns, outreach, CRM actions',
        badgeClass: 'badge-primary',
        icon: '📣',
    },
    marketing_development: {
        label: 'Marketing Dev',
        description: 'Research, discovery, enrichment',
        badgeClass: 'badge-info',
        icon: '🧩',
    },
    sales: {
        label: 'Sales',
        description: 'Replies, demos, closing actions',
        badgeClass: 'badge-success',
        icon: '🤝',
    },
    support: {
        label: 'Support',
        description: 'Install, onboarding, activation',
        badgeClass: 'badge-warning',
        icon: '🛠️',
    },
    other: {
        label: 'Other',
        description: 'Custom planning role',
        badgeClass: 'badge-ghost',
        icon: '👤',
    },
};

const marketingSkills: MarketingSkill[] = [
    'store_research',
    'contact_discovery',
    'email_outreach',
    'follow_up',
    'install_guidance',
    'onboarding',
    'crm_review',
    'copywriting',
    'reporting',
];

const weekDays = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' },
];

const emptyForm: UserForm = {
    username: '',
    password: '',
    displayName: '',
    role: 'marketing',
    skills: [],
    workingHoursPerDay: 6,
    workingDays: [1, 2, 3, 4, 5],
    efficiencyFactor: 0.8,
    maxTasksPerDay: 25,
    notes: '',
};

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

function getRoleMeta(role?: string | null) {
    return employeeRoleMeta[role || 'other'] || employeeRoleMeta.other;
}

function getInitials(value?: string | null) {
    const cleanValue = String(value || '').trim();

    if (!cleanValue) return 'U';

    const parts = cleanValue.split(/\s+/).filter(Boolean);

    if (parts.length === 1) {
        return parts[0].slice(0, 2).toUpperCase();
    }

    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getProfile(user: AdminUser): Required<MarketingProfile> {
    const profile = user.marketingProfile || {};

    return {
        displayName: profile.displayName || '',
        role: profile.role || 'marketing',
        skills: profile.skills || [],
        workingHoursPerDay: Number(profile.workingHoursPerDay ?? 6),
        workingDays: profile.workingDays || [1, 2, 3, 4, 5],
        efficiencyFactor: Number(profile.efficiencyFactor ?? 0.8),
        maxTasksPerDay: Number(profile.maxTasksPerDay ?? 25),
        isMarketingMember: Boolean(profile.isMarketingMember),
        notes: profile.notes || '',
    };
}

function isEmployeeUser(user: AdminUser) {
    const profile = getProfile(user);

    return (
        profile.isMarketingMember &&
        profile.role !== 'admin' &&
        profile.role !== 'manager'
    );
}

function getDailyCapacityMinutes(profile?: MarketingProfile) {
    const hours = Number(profile?.workingHoursPerDay || 0);
    const efficiency = Number(profile?.efficiencyFactor ?? 0.8);

    return Math.floor(hours * 60 * efficiency);
}

function getWeeklyCapacityMinutes(profile?: MarketingProfile) {
    const daily = getDailyCapacityMinutes(profile);
    const days = profile?.workingDays?.length || 0;

    return daily * days;
}

function getCapacityPercent(profile: MarketingProfile) {
    const dailyMinutes = getDailyCapacityMinutes(profile);
    const totalMinutes = Number(profile.workingHoursPerDay || 0) * 60;

    if (!totalMinutes) return 0;

    return Math.min(Math.round((dailyMinutes / totalMinutes) * 100), 100);
}

function getWorkingDaysLabel(days?: number[]) {
    if (!days || days.length === 0) return '-';

    return weekDays
        .filter((day) => days.includes(day.value))
        .map((day) => day.label)
        .join(', ');
}

function buildFormFromUser(user: AdminUser): UserForm {
    const profile = getProfile(user);

    return {
        username: user.username || '',
        password: '',
        displayName: profile.displayName || '',
        role:
            profile.role === 'admin' || profile.role === 'manager'
                ? 'marketing'
                : profile.role || 'marketing',
        skills: profile.skills || [],
        workingHoursPerDay: profile.workingHoursPerDay || 6,
        workingDays: profile.workingDays || [1, 2, 3, 4, 5],
        efficiencyFactor: profile.efficiencyFactor ?? 0.8,
        maxTasksPerDay: profile.maxTasksPerDay || 25,
        notes: profile.notes || '',
    };
}

function buildPayload(form: UserForm, mode: 'create' | 'edit') {
    const payload: any = {
        username: form.username.trim().toLowerCase(),
        marketingProfile: {
            displayName: form.displayName.trim(),
            role: form.role,
            skills: form.skills,
            workingHoursPerDay: Number(form.workingHoursPerDay || 0),
            workingDays: form.workingDays.map(Number),
            efficiencyFactor: Number(form.efficiencyFactor || 0.8),
            maxTasksPerDay: Number(form.maxTasksPerDay || 1),
            isMarketingMember: true,
            notes: form.notes.trim(),
        },
    };

    if (mode === 'create' || form.password.trim()) {
        payload.password = form.password;
    }

    return payload;
}

function MarketingCapacityPage() {
    const [employees, setEmployees] = useState<AdminUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isRemoving, setIsRemoving] = useState(false);

    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');

    const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
    const [activeUser, setActiveUser] = useState<AdminUser | null>(null);
    const [form, setForm] = useState<UserForm>(emptyForm);

    const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);

    const filteredEmployees = useMemo(() => {
        const keyword = search.trim().toLowerCase();

        return employees.filter((user) => {
            const profile = getProfile(user);

            const searchableText = `${user.username} ${profile.displayName} ${profile.role
                } ${profile.skills.join(' ')}`.toLowerCase();

            const matchesKeyword = !keyword || searchableText.includes(keyword);
            const matchesRole = !roleFilter || profile.role === roleFilter;

            return matchesKeyword && matchesRole;
        });
    }, [employees, search, roleFilter]);

    const summary = useMemo(() => {
        const totalDailyMinutes = employees.reduce((sum, user) => {
            return sum + getDailyCapacityMinutes(user.marketingProfile);
        }, 0);

        const totalWeeklyMinutes = employees.reduce((sum, user) => {
            return sum + getWeeklyCapacityMinutes(user.marketingProfile);
        }, 0);

        const totalMaxTasks = employees.reduce((sum, user) => {
            return sum + Number(user.marketingProfile?.maxTasksPerDay || 0);
        }, 0);

        return {
            totalEmployees: employees.length,
            dailyHours: Math.round((totalDailyMinutes / 60) * 10) / 10,
            weeklyHours: Math.round((totalWeeklyMinutes / 60) * 10) / 10,
            maxDailyTasks: totalMaxTasks,
        };
    }, [employees]);

    const loadEmployees = async () => {
        try {
            setIsLoading(true);

            const response = await api.get(USERS_MARKETING_MEMBERS_API);

            const nextEmployees = (response?.data?.users || []).filter(isEmployeeUser);

            setEmployees(nextEmployees);
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to load marketing employees.'));
        } finally {
            setIsLoading(false);
        }
    };

    const openCreateModal = () => {
        setActiveUser(null);
        setForm(emptyForm);
        setModalMode('create');
    };

    const openEditModal = (user: AdminUser) => {
        setActiveUser(user);
        setForm(buildFormFromUser(user));
        setModalMode('edit');
    };

    const closeModal = () => {
        setModalMode(null);
        setActiveUser(null);
        setForm(emptyForm);
    };

    const toggleSkill = (skill: MarketingSkill) => {
        setForm((current) => {
            const exists = current.skills.includes(skill);

            return {
                ...current,
                skills: exists
                    ? current.skills.filter((item) => item !== skill)
                    : [...current.skills, skill],
            };
        });
    };

    const toggleWorkingDay = (day: number) => {
        setForm((current) => {
            const exists = current.workingDays.includes(day);

            return {
                ...current,
                workingDays: exists
                    ? current.workingDays.filter((item) => item !== day)
                    : [...current.workingDays, day].sort((a, b) => a - b),
            };
        });
    };

    const submitForm = async () => {
        if (!form.username.trim()) {
            toast.error('Username is required.');
            return;
        }

        if (modalMode === 'create' && !form.password.trim()) {
            toast.error('Password is required for new employee.');
            return;
        }

        if (form.password.trim() && form.password.trim().length < 6) {
            toast.error('Password must be at least 6 characters.');
            return;
        }

        if (form.skills.length === 0) {
            toast.error('Select at least one marketing skill.');
            return;
        }

        if (form.workingDays.length === 0) {
            toast.error('Select at least one working day.');
            return;
        }

        if (form.role === 'admin' || form.role === 'manager') {
            toast.error('Managers and admins should not be managed on this screen.');
            return;
        }

        try {
            setIsSaving(true);

            const payload = buildPayload(form, modalMode || 'create');

            if (modalMode === 'edit' && activeUser?._id) {
                await api.put(`${USERS_ADMIN_API}/${activeUser._id}`, payload);
                toast.success('Employee capacity updated successfully.');
            } else {
                await api.post(USERS_ADMIN_API, payload);
                toast.success('Employee created successfully.');
            }

            closeModal();
            await loadEmployees();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to save employee.'));
        } finally {
            setIsSaving(false);
        }
    };

    const removeFromPlanner = async () => {
        if (!removeTarget?._id) return;

        try {
            setIsRemoving(true);

            const profile = getProfile(removeTarget);

            await api.put(`${USERS_ADMIN_API}/${removeTarget._id}`, {
                username: removeTarget.username,
                marketingProfile: {
                    ...profile,
                    isMarketingMember: false,
                },
            });

            toast.success('Employee removed from marketing planner.');

            setRemoveTarget(null);
            await loadEmployees();
        } catch (error: any) {
            toast.error(getErrorMessage(error, 'Failed to remove employee from planner.'));
        } finally {
            setIsRemoving(false);
        }
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    return (
        <DashboardLayout>
            <Head>
                <title>Marketing Capacity | Marketing Assistant Panel</title>
            </Head>

            <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
                <div className="mx-auto max-w-[1500px] space-y-6 px-4 md:px-6">
                    <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
                        <div className="border-b border-base-300 p-5 md:p-7">
                            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h1 className="text-2xl font-bold text-base-content md:text-3xl">
                                            Marketing Capacity
                                        </h1>

                                        <span className="badge badge-primary badge-outline">
                                            Employees Only
                                        </span>

                                        <span className="badge badge-info badge-outline">
                                            Daily Planner Ready
                                        </span>
                                    </div>

                                    <p className="mt-2 max-w-3xl text-sm leading-6 text-base-content/70">
                                        This page is only for marketing employees/operators used by the daily
                                        marketing task planner. Admins and managers stay separated in the Users
                                        section.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        onClick={loadEmployees}
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="loading loading-spinner loading-sm" />
                                                Loading
                                            </>
                                        ) : (
                                            'Refresh'
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        onClick={openCreateModal}
                                    >
                                        Create Employee
                                    </button>
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-primary">
                                        Employees
                                    </div>
                                    <div className="mt-1 text-2xl font-bold">{summary.totalEmployees}</div>
                                </div>

                                <div className="rounded-2xl border border-info/20 bg-info/5 p-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-info">
                                        Daily Capacity
                                    </div>
                                    <div className="mt-1 text-2xl font-bold">{summary.dailyHours}h</div>
                                </div>

                                <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-success">
                                        Weekly Capacity
                                    </div>
                                    <div className="mt-1 text-2xl font-bold">{summary.weeklyHours}h</div>
                                </div>

                                <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
                                    <div className="text-xs font-medium uppercase tracking-wide text-warning">
                                        Max Daily Tasks
                                    </div>
                                    <div className="mt-1 text-2xl font-bold">{summary.maxDailyTasks}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6 p-5 md:p-7">
                            <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
                                    <div className="form-control lg:col-span-7">
                                        <label className="label">
                                            <span className="label-text">Search employees</span>
                                        </label>
                                        <br />
                                        <input
                                            className="input input-bordered bg-base-100"
                                            value={search}
                                            onChange={(event) => setSearch(event.target.value)}
                                            placeholder="Search username, display name, role, or skill"
                                        />
                                    </div>

                                    <div className="form-control lg:col-span-4">
                                        <label className="label">
                                            <span className="label-text">Role</span>
                                        </label>
                                        <br />
                                        <select
                                            className="select select-bordered bg-base-100"
                                            value={roleFilter}
                                            onChange={(event) => setRoleFilter(event.target.value)}
                                        >
                                            <option value="">All employee roles</option>
                                            {employeeRoles.map((role) => {
                                                const meta = getRoleMeta(role);

                                                return (
                                                    <option key={role} value={role}>
                                                        {meta.label}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>

                                    <div className="flex items-end lg:col-span-1">
                                        <button
                                            type="button"
                                            className="btn btn-ghost w-full"
                                            onClick={() => {
                                                setSearch('');
                                                setRoleFilter('');
                                            }}
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
                                <div className="flex flex-col gap-3 border-b border-base-300 p-5 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h2 className="text-lg font-semibold">
                                            Marketing Employees & Capacity
                                        </h2>
                                        <p className="mt-1 text-sm text-base-content/60">
                                            Employees available for automatic daily marketing task planning.
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="badge badge-primary badge-outline">
                                            {filteredEmployees.length} visible
                                        </span>
                                        <span className="badge badge-ghost">{employees.length} total</span>
                                    </div>
                                </div>

                                {isLoading ? (
                                    <div className="flex items-center justify-center py-24">
                                        <span className="loading loading-spinner loading-lg" />
                                    </div>
                                ) : filteredEmployees.length === 0 ? (
                                    <div className="px-6 py-16 text-center">
                                        <div className="text-4xl">👥</div>
                                        <h3 className="mt-3 text-lg font-semibold">
                                            No marketing employees found
                                        </h3>
                                        <p className="mt-2 text-sm text-base-content/60">
                                            Create an employee or change your filters.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-auto">
                                        <table className="table min-w-[1380px]">
                                            <thead>
                                                <tr className="border-b border-base-300 bg-base-200/70">
                                                    <th className="w-[260px]">Employee</th>
                                                    <th className="w-[260px]">Planning Role</th>
                                                    <th className="w-[310px]">Skills</th>
                                                    <th className="w-[180px]">Schedule</th>
                                                    <th className="w-[220px]">Capacity</th>
                                                    <th className="w-[160px]">Task Limit</th>
                                                    <th className="w-[170px]">Updated</th>
                                                    <th className="w-[170px] text-right">Actions</th>
                                                </tr>
                                            </thead>

                                            <tbody>
                                                {filteredEmployees.map((user) => {
                                                    const profile = getProfile(user);
                                                    const roleMeta = getRoleMeta(profile.role);
                                                    const dailyMinutes = getDailyCapacityMinutes(profile);
                                                    const weeklyMinutes = getWeeklyCapacityMinutes(profile);
                                                    const capacityPercent = getCapacityPercent(profile);

                                                    return (
                                                        <tr
                                                            key={user._id}
                                                            className="border-b border-base-200 transition hover:bg-base-200/45"
                                                        >
                                                            <td>
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-black text-primary">
                                                                        {getInitials(profile.displayName || user.username)}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="truncate font-semibold text-base-content">
                                                                            {profile.displayName || user.username}
                                                                        </div>

                                                                        <div className="mt-1 truncate text-xs text-base-content/50">
                                                                            @{user.username}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="rounded-2xl border border-base-300 bg-base-100 p-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-lg">{roleMeta.icon}</span>

                                                                        <span
                                                                            className={`badge badge-outline ${roleMeta.badgeClass}`}
                                                                        >
                                                                            {roleMeta.label}
                                                                        </span>
                                                                    </div>

                                                                    <div className="mt-2 text-xs leading-5 text-base-content/55">
                                                                        {roleMeta.description}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="flex max-w-[300px] flex-wrap gap-1.5">
                                                                    {profile.skills.length === 0 ? (
                                                                        <span className="rounded-xl border border-dashed border-base-300 px-3 py-2 text-xs text-base-content/45">
                                                                            No skills configured
                                                                        </span>
                                                                    ) : (
                                                                        profile.skills.slice(0, 6).map((skill) => (
                                                                            <span
                                                                                key={skill}
                                                                                className="rounded-full border border-base-300 bg-base-200/70 px-2.5 py-1 text-[11px] font-medium text-base-content/70"
                                                                            >
                                                                                {humanize(skill)}
                                                                            </span>
                                                                        ))
                                                                    )}

                                                                    {profile.skills.length > 6 && (
                                                                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                                                                            +{profile.skills.length - 6}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="space-y-1.5">
                                                                    <div className="text-sm font-semibold text-base-content">
                                                                        {profile.workingHoursPerDay}h / day
                                                                    </div>

                                                                    <div className="text-xs text-base-content/50">
                                                                        {getWorkingDaysLabel(profile.workingDays)}
                                                                    </div>

                                                                    <div className="badge badge-ghost badge-sm">
                                                                        {profile.workingDays.length} working days
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="space-y-2">
                                                                    <div className="flex items-center justify-between gap-3">
                                                                        <span className="text-sm font-semibold text-base-content">
                                                                            {Math.round((dailyMinutes / 60) * 10) / 10}h/day
                                                                        </span>

                                                                        <span className="text-xs font-medium text-base-content/50">
                                                                            {Math.round(profile.efficiencyFactor * 100)}%
                                                                        </span>
                                                                    </div>

                                                                    <progress
                                                                        className="progress progress-primary h-2 w-full"
                                                                        value={capacityPercent}
                                                                        max={100}
                                                                    />

                                                                    <div className="text-xs text-base-content/50">
                                                                        {Math.round((weeklyMinutes / 60) * 10) / 10}h/week useful capacity
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
                                                                    <div className="text-xs uppercase tracking-wide text-warning">
                                                                        Max/day
                                                                    </div>

                                                                    <div className="mt-1 text-xl font-black text-base-content">
                                                                        {profile.maxTasksPerDay}
                                                                    </div>
                                                                </div>
                                                            </td>

                                                            <td>
                                                                <div className="text-sm text-base-content/70">
                                                                    {formatDateTime(user.updatedAt)}
                                                                </div>
                                                            </td>

                                                            <td className="text-right">
                                                                <div className="flex justify-end gap-2">
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-primary btn-sm"
                                                                        onClick={() => openEditModal(user)}
                                                                    >
                                                                        Edit
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-warning btn-outline btn-sm"
                                                                        onClick={() => setRemoveTarget(user)}
                                                                    >
                                                                        Remove
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {modalMode && (
                        <dialog open className="modal">
                            <div className="modal-box max-h-[92vh] max-w-6xl overflow-y-auto rounded-3xl">
                                <div className="mb-6 flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-base-content">
                                            {modalMode === 'create'
                                                ? 'Create Marketing Employee'
                                                : 'Edit Employee Capacity'}
                                        </h3>

                                        <p className="mt-1 text-sm text-base-content/70">
                                            This form creates or updates a user that is included in the marketing
                                            daily task planner. It does not manage managers/admins.
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

                                <div className="overflow-hidden rounded-3xl border border-base-300 bg-base-100">
                                    <div className="border-b border-base-300 bg-gradient-to-r from-primary/10 via-base-100 to-base-100 p-5">
                                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-lg font-bold">Employee Profile</h4>

                                                    <span className="badge badge-success badge-outline">
                                                        Planner Employee
                                                    </span>
                                                </div>

                                                <p className="mt-1 text-sm text-base-content/60">
                                                    The daily planner will use this employee’s skills and capacity when
                                                    generating marketing tasks.
                                                </p>
                                            </div>

                                            <div className="rounded-2xl border border-success/20 bg-success/10 px-4 py-3">
                                                <div className="text-xs uppercase tracking-wide text-success">
                                                    Included in Planner
                                                </div>
                                                <div className="mt-1 text-sm font-semibold text-base-content">
                                                    This employee can receive daily marketing tasks.
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-0 xl:grid-cols-[360px_1fr]">
                                        <div className="border-b border-base-300 bg-base-200/30 p-5 xl:border-b-0 xl:border-r">
                                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                <div className="text-sm font-bold">Capacity Preview</div>

                                                <div className="mt-4 space-y-3">
                                                    <div className="rounded-xl bg-base-200/70 p-3">
                                                        <div className="text-xs text-base-content/50">
                                                            Useful daily time
                                                        </div>
                                                        <div className="mt-1 text-xl font-black text-primary">
                                                            {Math.round(
                                                                ((form.workingHoursPerDay *
                                                                    60 *
                                                                    form.efficiencyFactor) /
                                                                    60) *
                                                                10
                                                            ) / 10}
                                                            h
                                                        </div>
                                                    </div>

                                                    <div className="rounded-xl bg-base-200/70 p-3">
                                                        <div className="text-xs text-base-content/50">
                                                            Useful weekly time
                                                        </div>
                                                        <div className="mt-1 text-xl font-black text-info">
                                                            {Math.round(
                                                                ((form.workingHoursPerDay *
                                                                    60 *
                                                                    form.efficiencyFactor *
                                                                    form.workingDays.length) /
                                                                    60) *
                                                                10
                                                            ) / 10}
                                                            h
                                                        </div>
                                                    </div>

                                                    <div className="rounded-xl bg-base-200/70 p-3">
                                                        <div className="text-xs text-base-content/50">
                                                            Daily task cap
                                                        </div>
                                                        <div className="mt-1 text-xl font-black text-warning">
                                                            {form.maxTasksPerDay}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 p-4">
                                                <div className="text-sm font-bold">Planner Rule</div>
                                                <p className="mt-2 text-xs leading-5 text-base-content/60">
                                                    The planner should assign tasks only when this employee has matching
                                                    skills, enough remaining minutes, and has not exceeded the daily
                                                    task cap.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="space-y-5 p-5">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-semibold">Username</span>
                                                        <span className="label-text-alt text-error">Required</span>
                                                    </label>

                                                    <input
                                                        className="input input-bordered h-12 bg-base-100"
                                                        value={form.username}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                username: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="employee_username"
                                                        autoComplete="off"
                                                    />
                                                </div>

                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-semibold">
                                                            {modalMode === 'create' ? 'Password' : 'New password'}
                                                        </span>
                                                        {modalMode === 'create' && (
                                                            <span className="label-text-alt text-error">Required</span>
                                                        )}
                                                    </label>

                                                    <input
                                                        type="password"
                                                        className="input input-bordered h-12 bg-base-100"
                                                        value={form.password}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                password: event.target.value,
                                                            }))
                                                        }
                                                        placeholder={
                                                            modalMode === 'create'
                                                                ? 'Minimum 6 characters'
                                                                : 'Leave empty to keep current password'
                                                        }
                                                        autoComplete="new-password"
                                                    />
                                                </div>

                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-semibold">Display name</span>
                                                    </label>

                                                    <input
                                                        className="input input-bordered h-12 bg-base-100"
                                                        value={form.displayName}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                displayName: event.target.value,
                                                            }))
                                                        }
                                                        placeholder="Full name for planner display"
                                                    />
                                                </div>

                                                <div className="form-control">
                                                    <label className="label">
                                                        <span className="label-text font-semibold">Employee role</span>
                                                    </label>

                                                    <select
                                                        className="select select-bordered h-12 bg-base-100"
                                                        value={form.role}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                role: event.target.value as MarketingRole,
                                                            }))
                                                        }
                                                    >
                                                        {employeeRoles.map((role) => {
                                                            const meta = getRoleMeta(role);

                                                            return (
                                                                <option key={role} value={role}>
                                                                    {meta.label}
                                                                </option>
                                                            );
                                                        })}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <div className="font-semibold">Planning Role</div>
                                                        <div className="text-xs text-base-content/50">
                                                            Select the employee’s operational function for task assignment.
                                                        </div>
                                                    </div>

                                                    <span
                                                        className={`badge badge-outline ${getRoleMeta(form.role).badgeClass}`}
                                                    >
                                                        {getRoleMeta(form.role).label}
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                                                    {employeeRoles.map((role) => {
                                                        const meta = getRoleMeta(role);
                                                        const active = form.role === role;

                                                        return (
                                                            <button
                                                                key={role}
                                                                type="button"
                                                                className={`rounded-2xl border p-4 text-left transition ${active
                                                                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                                                                        : 'border-base-300 bg-base-200/40 hover:border-primary/40 hover:bg-base-100'
                                                                    }`}
                                                                onClick={() =>
                                                                    setForm((current) => ({
                                                                        ...current,
                                                                        role,
                                                                    }))
                                                                }
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xl">{meta.icon}</span>

                                                                    <span className={`badge badge-outline ${meta.badgeClass}`}>
                                                                        {meta.label}
                                                                    </span>
                                                                </div>

                                                                <div className="mt-2 text-xs leading-5 text-base-content/60">
                                                                    {meta.description}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <div className="font-semibold">Skills</div>
                                                        <div className="text-xs text-base-content/50">
                                                            Task assignment uses these skills for employee matching.
                                                        </div>
                                                    </div>

                                                    <span className="badge badge-outline">
                                                        {form.skills.length} selected
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                                    {marketingSkills.map((skill) => {
                                                        const active = form.skills.includes(skill);

                                                        return (
                                                            <button
                                                                key={skill}
                                                                type="button"
                                                                className={`btn btn-sm justify-start ${active ? 'btn-primary' : 'btn-outline'
                                                                    }`}
                                                                onClick={() => toggleSkill(skill)}
                                                            >
                                                                {humanize(skill)}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                                                <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div>
                                                            <div className="font-semibold">Working hours</div>
                                                            <div className="text-xs text-base-content/50">
                                                                Hours per day
                                                            </div>
                                                        </div>

                                                        <span className="rounded-2xl bg-primary/10 px-3 py-1 text-lg font-black text-primary">
                                                            {form.workingHoursPerDay}h
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="range"
                                                        min={0}
                                                        max={16}
                                                        step={0.5}
                                                        className="range range-primary range-sm"
                                                        value={form.workingHoursPerDay}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                workingHoursPerDay: Number(event.target.value),
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div>
                                                            <div className="font-semibold">Efficiency</div>
                                                            <div className="text-xs text-base-content/50">
                                                                Useful work percentage
                                                            </div>
                                                        </div>

                                                        <span className="rounded-2xl bg-info/10 px-3 py-1 text-lg font-black text-info">
                                                            {Math.round(form.efficiencyFactor * 100)}%
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="range"
                                                        min={10}
                                                        max={100}
                                                        step={5}
                                                        className="range range-info range-sm"
                                                        value={Math.round(form.efficiencyFactor * 100)}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                efficiencyFactor: Number(event.target.value) / 100,
                                                            }))
                                                        }
                                                    />
                                                </div>

                                                <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div>
                                                            <div className="font-semibold">Max tasks</div>
                                                            <div className="text-xs text-base-content/50">
                                                                Daily task limit
                                                            </div>
                                                        </div>

                                                        <span className="rounded-2xl bg-warning/10 px-3 py-1 text-lg font-black text-warning">
                                                            {form.maxTasksPerDay}
                                                        </span>
                                                    </div>

                                                    <input
                                                        type="range"
                                                        min={1}
                                                        max={200}
                                                        step={1}
                                                        className="range range-warning range-sm"
                                                        value={form.maxTasksPerDay}
                                                        onChange={(event) =>
                                                            setForm((current) => ({
                                                                ...current,
                                                                maxTasksPerDay: Number(event.target.value),
                                                            }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-base-300 bg-base-100 p-4">
                                                <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                                    <div>
                                                        <div className="font-semibold">Working days</div>
                                                        <div className="text-xs text-base-content/50">
                                                            Planner should only assign tasks on selected days.
                                                        </div>
                                                    </div>

                                                    <span className="badge badge-outline">
                                                        {form.workingDays.length} days
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
                                                    {weekDays.map((day) => {
                                                        const active = form.workingDays.includes(day.value);

                                                        return (
                                                            <button
                                                                key={day.value}
                                                                type="button"
                                                                className={`btn btn-sm ${active ? 'btn-primary' : 'btn-outline'
                                                                    }`}
                                                                onClick={() => toggleWorkingDay(day.value)}
                                                            >
                                                                {day.label}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
                                                <div className="border-b border-base-300 bg-base-200/40 p-4">
                                                    <div className="font-semibold">Notes</div>
                                                    <div className="mt-1 text-xs text-base-content/50">
                                                        Internal notes about this employee’s work style, limits, or assignment rules.
                                                    </div>
                                                </div>

                                                <textarea
                                                    className="min-h-[120px] w-full resize-none bg-base-100 p-4 text-sm leading-7 outline-none placeholder:text-base-content/35"
                                                    value={form.notes}
                                                    onChange={(event) =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            notes: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Example: Better for follow-up and CRM review. Avoid assigning contact discovery tasks."
                                                />

                                                <div className="flex items-center justify-between border-t border-base-300 bg-base-200/30 px-4 py-2 text-xs text-base-content/50">
                                                    <span>Internal planner note</span>
                                                    <span>{form.notes.length} characters</span>
                                                </div>
                                            </div>

                                            <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-base-300 bg-base-100/95 p-5 backdrop-blur">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div className="text-sm text-base-content/60">
                                                        {modalMode === 'create' ? 'Creating' : 'Updating'}{' '}
                                                        <span className="font-semibold text-base-content">
                                                            {form.displayName || form.username || 'employee'}
                                                        </span>{' '}
                                                        as{' '}
                                                        <span className="font-semibold text-base-content">
                                                            {getRoleMeta(form.role).label}
                                                        </span>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost"
                                                            onClick={closeModal}
                                                        >
                                                            Cancel
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className={`btn btn-primary min-w-[170px] ${isSaving ? 'btn-disabled' : ''
                                                                }`}
                                                            onClick={submitForm}
                                                        >
                                                            {isSaving ? (
                                                                <>
                                                                    <span className="loading loading-spinner loading-sm" />
                                                                    Saving
                                                                </>
                                                            ) : modalMode === 'create' ? (
                                                                'Create Employee'
                                                            ) : (
                                                                'Save Capacity'
                                                            )}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <form method="dialog" className="modal-backdrop">
                                <button type="button" onClick={closeModal}>
                                    close
                                </button>
                            </form>
                        </dialog>
                    )}

                    {removeTarget && (
                        <dialog open className="modal">
                            <div className="modal-box rounded-3xl">
                                <h3 className="text-lg font-bold">Remove from planner?</h3>

                                <p className="mt-2 text-sm leading-6 text-base-content/70">
                                    This will remove{' '}
                                    <span className="font-semibold text-base-content">
                                        {removeTarget.username}
                                    </span>{' '}
                                    from the marketing capacity planner. The login user will not be deleted.
                                </p>

                                <div className="modal-action">
                                    <button
                                        type="button"
                                        className="btn btn-ghost"
                                        onClick={() => setRemoveTarget(null)}
                                        disabled={isRemoving}
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        className={`btn btn-warning ${isRemoving ? 'btn-disabled' : ''}`}
                                        onClick={removeFromPlanner}
                                    >
                                        {isRemoving ? (
                                            <>
                                                <span className="loading loading-spinner loading-sm" />
                                                Removing
                                            </>
                                        ) : (
                                            'Remove from Planner'
                                        )}
                                    </button>
                                </div>
                            </div>

                            <form method="dialog" className="modal-backdrop">
                                <button type="button" onClick={() => setRemoveTarget(null)}>
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

export default dynamic(() => Promise.resolve(MarketingCapacityPage), {
    ssr: false,
});