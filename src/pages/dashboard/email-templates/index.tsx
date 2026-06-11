import dynamic from 'next/dynamic';
import Head from 'next/head';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CheckCircleIcon,
  DocumentDuplicateIcon,
  EnvelopeIcon,
  EyeIcon,
  PencilSquareIcon,
  StarIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';

type TemplateStatus = 'draft' | 'active' | 'archived';
type SortOrder = 'asc' | 'desc';

type TemplateVariable = {
  key: string;
  label?: string;
  description?: string;
  fallback?: string;
  required?: boolean;
};

type EmailTemplate = {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  category: string;
  status: TemplateStatus;
  language: string;
  tone: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  variables?: TemplateVariable[];
  tags?: string[];
  target?: {
    platform?: string;
    industry?: string;
    leadStatus?: string;
    country?: string;
  };
  isDefault?: boolean;
  isSystem?: boolean;
  usageCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PaginationMeta = {
  page: number;
  limit: number;
  totalDocs: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};

type TemplateForm = {
  name: string;
  slug: string;
  description: string;
  category: string;
  status: TemplateStatus;
  language: string;
  tone: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  tagsText: string;
  targetPlatform: string;
  targetIndustry: string;
  targetLeadStatus: string;
  targetCountry: string;
  isDefault: boolean;
};

type MetaOptions = {
  categories: string[];
  statuses: string[];
  languages: string[];
  tones: string[];
  placeholders: string[];
};

type RenderedPreview = {
  subject: string;
  bodyText: string;
  bodyHtml?: string;
};

const fallbackMeta: MetaOptions = {
  categories: [
    'cold_outreach',
    'follow_up',
    'reply',
    'demo_invite',
    'proposal',
    'onboarding',
    'reactivation',
    'custom',
  ],
  statuses: ['draft', 'active', 'archived'],
  languages: ['en', 'fa', 'de', 'ar', 'tr'],
  tones: [
    'professional',
    'friendly',
    'direct',
    'warm',
    'persuasive',
    'short',
    'formal',
  ],
  placeholders: [
    '{{storeName}}',
    '{{storeDomain}}',
    '{{contactName}}',
    '{{contactRole}}',
    '{{industry}}',
    '{{platform}}',
    '{{country}}',
    '{{painPoint}}',
    '{{recommendedPitch}}',
    '{{senderName}}',
    '{{senderCompany}}',
  ],
};

const emptyForm: TemplateForm = {
  name: '',
  slug: '',
  description: '',
  category: 'cold_outreach',
  status: 'draft',
  language: 'en',
  tone: 'professional',
  subject: '',
  bodyText: '',
  bodyHtml: '',
  tagsText: '',
  targetPlatform: 'shopify',
  targetIndustry: '',
  targetLeadStatus: 'new',
  targetCountry: '',
  isDefault: false,
};

const initialPagination: PaginationMeta = {
  page: 1,
  limit: 20,
  totalDocs: 0,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};

function getErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown; error?: unknown } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { error?: unknown } } }).response?.data?.error === 'string'
  ) {
    return (error as { response: { data: { error: string } } }).response.data.error;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

function humanize(value?: string) {
  if (!value) return '—';

  return value
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return '—';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString();
}

function extractVariables(...texts: string[]): TemplateVariable[] {
  const keys = new Set<string>();

  texts.forEach((text) => {
    const matches = String(text || '').matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g);

    for (const match of matches) {
      if (match[1]) keys.add(match[1]);
    }
  });

  return [...keys].map((key) => ({
    key,
    label: humanize(key),
    fallback: '',
    required: false,
  }));
}

function exampleValueForKey(key: string) {
  const normalized = key.toLowerCase();

  if (normalized.includes('store')) return 'Blue Fashion Store';
  if (normalized.includes('domain')) return 'bluefashion.com';
  if (normalized.includes('contact')) return 'Sarah';
  if (normalized.includes('role')) return 'Founder';
  if (normalized.includes('industry')) return 'fashion';
  if (normalized.includes('platform')) return 'Shopify';
  if (normalized.includes('country')) return 'Germany';
  if (normalized.includes('pain')) return 'limited sales visibility';
  if (normalized.includes('pitch')) return 'better product performance analytics';
  if (normalized.includes('sender')) return 'Arka Team';
  if (normalized.includes('company')) return 'Arka';

  return `Sample ${humanize(key)}`;
}

function buildPreviewVariables(template: EmailTemplate) {
  const variables = template.variables?.length
    ? template.variables
    : extractVariables(template.subject, template.bodyText, template.bodyHtml || '');

  const payload = variables.reduce<Record<string, string>>((acc, item) => {
    acc[item.key] = item.fallback || exampleValueForKey(item.key);
    return acc;
  }, {});

  return JSON.stringify(payload, null, 2);
}

function buildPayload(form: TemplateForm) {
  const tags = form.tagsText
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    description: form.description.trim(),
    category: form.category,
    status: form.status,
    language: form.language,
    tone: form.tone,
    subject: form.subject.trim(),
    bodyText: form.bodyText.trim(),
    bodyHtml: form.bodyHtml.trim(),
    variables: extractVariables(form.subject, form.bodyText, form.bodyHtml),
    tags,
    target: {
      platform: form.targetPlatform.trim().toLowerCase(),
      industry: form.targetIndustry.trim().toLowerCase(),
      leadStatus: form.targetLeadStatus.trim().toLowerCase(),
      country: form.targetCountry.trim(),
    },
    isDefault: form.isDefault,
  };
}

function templateToForm(template: EmailTemplate): TemplateForm {
  return {
    name: template.name || '',
    slug: template.slug || '',
    description: template.description || '',
    category: template.category || 'custom',
    status: template.status || 'draft',
    language: template.language || 'en',
    tone: template.tone || 'professional',
    subject: template.subject || '',
    bodyText: template.bodyText || '',
    bodyHtml: template.bodyHtml || '',
    tagsText: Array.isArray(template.tags) ? template.tags.join(', ') : '',
    targetPlatform: template.target?.platform || '',
    targetIndustry: template.target?.industry || '',
    targetLeadStatus: template.target?.leadStatus || '',
    targetCountry: template.target?.country || '',
    isDefault: Boolean(template.isDefault),
  };
}

function StatusBadge({ status }: { status: TemplateStatus }) {
  const className =
    status === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
      : status === 'archived'
        ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-300';

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>
      {humanize(status)}
    </span>
  );
}

function TemplateModal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className={`max-h-[90vh] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl dark:border-gray-800 dark:bg-gray-900 ${
          wide ? 'max-w-6xl' : 'max-w-4xl'
        }`}
      >
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-5">
          {children}
        </div>
      </div>
    </div>
  );
}

const EmailTemplatesPage = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [meta, setMeta] = useState<MetaOptions>(fallbackMeta);
  const [pagination, setPagination] = useState<PaginationMeta>(initialPagination);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState('');
  const [error, setError] = useState('');

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [tone, setTone] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EmailTemplate | null>(null);

  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [previewVariables, setPreviewVariables] = useState('{}');
  const [previewResult, setPreviewResult] = useState<RenderedPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const stats = useMemo(() => {
    const active = templates.filter((item) => item.status === 'active').length;
    const draft = templates.filter((item) => item.status === 'draft').length;
    const defaults = templates.filter((item) => item.isDefault).length;

    return {
      active,
      draft,
      defaults,
    };
  }, [templates]);

  const loadMeta = useCallback(async () => {
    try {
      const response = await api.get('/email-templates/meta');
      const data = response?.data?.data;

      if (!data) return;

      setMeta({
        categories: data.categories?.length ? data.categories : fallbackMeta.categories,
        statuses: data.statuses?.length ? data.statuses : fallbackMeta.statuses,
        languages: data.languages?.length ? data.languages : fallbackMeta.languages,
        tones: data.tones?.length ? data.tones : fallbackMeta.tones,
        placeholders: data.placeholders?.length ? data.placeholders : fallbackMeta.placeholders,
      });
    } catch {
      setMeta(fallbackMeta);
    }
  }, []);

  const loadTemplates = useCallback(
    async ({ silent = false, page = pagination.page }: { silent?: boolean; page?: number } = {}) => {
      try {
        if (!silent) setLoading(true);
        setError('');

        const response = await api.get('/email-templates', {
          params: {
            page,
            limit: pagination.limit,
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
            ...(category ? { category } : {}),
            ...(language ? { language } : {}),
            ...(tone ? { tone } : {}),
            sortBy,
            sortOrder,
          },
        });

        setTemplates(response?.data?.data?.templates || []);

        if (response?.data?.data?.pagination) {
          setPagination(response.data.data.pagination);
        }
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to load email templates'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      category,
      language,
      pagination.limit,
      pagination.page,
      q,
      sortBy,
      sortOrder,
      status,
      tone,
    ],
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadTemplates({ silent: true });
  };

  const handleApplyFilters = async () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    await loadTemplates({ silent: true, page: 1 });
  };

  const handleResetFilters = () => {
    setQ('');
    setStatus('');
    setCategory('');
    setLanguage('');
    setTone('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPagination(initialPagination);
  };

  const handlePageChange = async (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
    await loadTemplates({ silent: true, page });
  };

  const updateForm = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setForm(emptyForm);
    setModalMode('create');
  };

  const openEditModal = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setForm(templateToForm(template));
    setModalMode('edit');
  };

  const closeFormModal = () => {
    setModalMode(null);
    setEditingTemplate(null);
    setForm(emptyForm);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const payload = buildPayload(form);

    if (!payload.name) {
      toast.error('Template name is required');
      return;
    }

    if (!payload.subject) {
      toast.error('Template subject is required');
      return;
    }

    if (!payload.bodyText) {
      toast.error('Template body text is required');
      return;
    }

    try {
      setSaving(true);
      setError('');

      if (modalMode === 'edit' && editingTemplate?._id) {
        await api.patch(`/email-templates/${editingTemplate._id}`, payload);
        toast.success('Email template updated');
      } else {
        await api.post('/email-templates', payload);
        toast.success('Email template created');
      }

      closeFormModal();
      await loadTemplates({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save email template'));
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget?._id) return;

    try {
      setActingId(archiveTarget._id);
      setError('');

      await api.delete(`/email-templates/${archiveTarget._id}`);
      toast.success('Email template archived');
      setArchiveTarget(null);
      await loadTemplates({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to archive email template'));
    } finally {
      setActingId('');
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      setActingId(template._id);
      setError('');

      await api.post(`/email-templates/${template._id}/duplicate`);
      toast.success('Email template duplicated');
      await loadTemplates({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to duplicate email template'));
    } finally {
      setActingId('');
    }
  };

  const handleSetDefault = async (template: EmailTemplate) => {
    try {
      setActingId(template._id);
      setError('');

      await api.patch(`/email-templates/${template._id}/default`);
      toast.success('Default template updated');
      await loadTemplates({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to set default template'));
    } finally {
      setActingId('');
    }
  };

  const openPreview = (template: EmailTemplate) => {
    setPreviewTemplate(template);
    setPreviewVariables(buildPreviewVariables(template));
    setPreviewResult(null);
  };

  const closePreview = () => {
    setPreviewTemplate(null);
    setPreviewVariables('{}');
    setPreviewResult(null);
  };

  const handleRenderPreview = async () => {
    if (!previewTemplate?._id) return;

    let variables: Record<string, string>;

    try {
      variables = JSON.parse(previewVariables || '{}');
    } catch {
      toast.error('Variables must be valid JSON');
      return;
    }

    try {
      setPreviewLoading(true);

      const response = await api.post(`/email-templates/${previewTemplate._id}/render`, {
        variables,
      });

      setPreviewResult(response?.data?.data?.rendered || null);
      toast.success('Template rendered');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to render email template'));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadTemplates({ silent: true, page: 1 });
    }, 400);

    return () => clearTimeout(timer);
  }, [q, status, category, language, tone, sortBy, sortOrder]);

  return (
    <DashboardLayout>
      <Head>
        <title>Email Templates | Marketing Assistant Panel</title>
      </Head>

      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Email Templates
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Reusable CRM templates for outreach, follow-up, proposals, demos, and replies.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {pagination.totalDocs} templates
              </p>
            </div>

            <Button onClick={handleRefresh} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>

            <Button onClick={openCreateModal}>
              New Template
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.active}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Draft</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.draft}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Default</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
              {stats.defaults}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filters & Sorting
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Filter templates by category, status, language, tone, or search text.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search name, subject, body, tag..."
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />

            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All statuses</option>
              {meta.statuses.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>

            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All categories</option>
              {meta.categories.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>

            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All languages</option>
              {meta.languages.map((item) => (
                <option key={item} value={item}>
                  {item.toUpperCase()}
                </option>
              ))}
            </select>

            <select
              value={tone}
              onChange={(event) => setTone(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All tones</option>
              {meta.tones.map((item) => (
                <option key={item} value={item}>
                  {humanize(item)}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="createdAt">Created date</option>
              <option value="updatedAt">Updated date</option>
              <option value="name">Name</option>
              <option value="category">Category</option>
              <option value="status">Status</option>
              <option value="usageCount">Usage count</option>
            </select>

            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>

            <div className="flex gap-2">
              <Button onClick={handleApplyFilters}>
                Apply
              </Button>

              <Button onClick={handleResetFilters}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading email templates...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No email templates found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div
                key={template._id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <button
                    type="button"
                    onClick={() => openPreview(template)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={template.status} />

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {humanize(template.category)}
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {template.language?.toUpperCase() || '—'}
                      </span>

                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        {humanize(template.tone)}
                      </span>

                      {template.isDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          <StarSolidIcon className="h-3.5 w-3.5" />
                          Default
                        </span>
                      ) : null}

                      {(template.tags || []).slice(0, 5).map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-1 rounded-xl bg-blue-100 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                        <EnvelopeIcon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                          {template.name || '(Untitled template)'}
                        </h2>

                        <p className="mt-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">
                          {template.subject || '—'}
                        </p>

                        {template.description ? (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {template.description}
                          </p>
                        ) : (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {template.bodyText || '—'}
                          </p>
                        )}

                        <div className="mt-4 grid gap-2 text-sm text-gray-600 dark:text-gray-300 md:grid-cols-3">
                          <p>
                            <span className="font-medium text-gray-900 dark:text-white">
                              Platform:
                            </span>{' '}
                            {template.target?.platform || '—'}
                          </p>

                          <p>
                            <span className="font-medium text-gray-900 dark:text-white">
                              Industry:
                            </span>{' '}
                            {template.target?.industry || '—'}
                          </p>

                          <p>
                            <span className="font-medium text-gray-900 dark:text-white">
                              Lead:
                            </span>{' '}
                            {template.target?.leadStatus || '—'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </button>

                  <div className="flex shrink-0 flex-col items-start gap-3 text-sm text-gray-500 dark:text-gray-400 md:items-end md:pl-6">
                    <div className="text-left md:text-right">
                      <p>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {template.usageCount || 0}
                        </span>{' '}
                        uses
                      </p>
                      <p className="mt-1">Updated {formatDate(template.updatedAt)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <Button onClick={() => openPreview(template)}>
                        Preview
                      </Button>

                      <Button onClick={() => openEditModal(template)}>
                        Edit
                      </Button>

                      <Button
                        onClick={() => handleDuplicate(template)}
                        disabled={actingId === template._id}
                      >
                        {actingId === template._id ? 'Working...' : 'Duplicate'}
                      </Button>

                      <Button
                        onClick={() => handleSetDefault(template)}
                        disabled={actingId === template._id}
                      >
                        Default
                      </Button>

                      <Button
                        onClick={() => setArchiveTarget(template)}
                        disabled={actingId === template._id}
                      >
                        Archive
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-3 pt-2 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages} — {pagination.totalDocs} templates
              </p>

              <div className="flex gap-2">
                <Button
                  onClick={() => handlePageChange(Math.max(pagination.page - 1, 1))}
                  disabled={!pagination.hasPrevPage || loading}
                >
                  Previous
                </Button>

                <Button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={!pagination.hasNextPage || loading}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {modalMode ? (
          <TemplateModal
            title={modalMode === 'edit' ? 'Edit Email Template' : 'Create Email Template'}
            description="Create reusable CRM messages with dynamic placeholders."
            onClose={closeFormModal}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  placeholder="Template name"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />

                <input
                  value={form.slug}
                  onChange={(event) => updateForm('slug', event.target.value)}
                  placeholder="Optional slug"
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />

                <select
                  value={form.category}
                  onChange={(event) => updateForm('category', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {meta.categories.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>

                <select
                  value={form.status}
                  onChange={(event) => updateForm('status', event.target.value as TemplateStatus)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {meta.statuses.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>

                <select
                  value={form.language}
                  onChange={(event) => updateForm('language', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {meta.languages.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>

                <select
                  value={form.tone}
                  onChange={(event) => updateForm('tone', event.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                >
                  {meta.tones.map((item) => (
                    <option key={item} value={item}>
                      {humanize(item)}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                rows={2}
                placeholder="Internal description"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <input
                value={form.subject}
                onChange={(event) => updateForm('subject', event.target.value)}
                placeholder="Subject, for example: Better sales visibility for {{storeName}}"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <textarea
                value={form.bodyText}
                onChange={(event) => updateForm('bodyText', event.target.value)}
                rows={9}
                placeholder="Body text"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <textarea
                value={form.bodyHtml}
                onChange={(event) => updateForm('bodyHtml', event.target.value)}
                rows={4}
                placeholder="Optional body HTML"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Targeting
                </h3>

                <div className="mt-3 grid gap-3 md:grid-cols-4">
                  <input
                    value={form.targetPlatform}
                    onChange={(event) => updateForm('targetPlatform', event.target.value)}
                    placeholder="Platform"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />

                  <input
                    value={form.targetIndustry}
                    onChange={(event) => updateForm('targetIndustry', event.target.value)}
                    placeholder="Industry"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />

                  <input
                    value={form.targetLeadStatus}
                    onChange={(event) => updateForm('targetLeadStatus', event.target.value)}
                    placeholder="Lead status"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />

                  <input
                    value={form.targetCountry}
                    onChange={(event) => updateForm('targetCountry', event.target.value)}
                    placeholder="Country"
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                </div>
              </div>

              <input
                value={form.tagsText}
                onChange={(event) => updateForm('tagsText', event.target.value)}
                placeholder="Tags separated by commas"
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />

              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                      Available placeholders
                    </h3>
                    <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                      Click a placeholder to copy it.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-200">
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(event) => updateForm('isDefault', event.target.checked)}
                    />
                    Set as default
                  </label>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {meta.placeholders.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(item);
                        toast.success(`${item} copied`);
                      }}
                      className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-200"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeFormModal}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <CheckCircleIcon className="h-5 w-5" />
                  {saving ? 'Saving...' : modalMode === 'edit' ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </TemplateModal>
        ) : null}

        {archiveTarget ? (
          <TemplateModal
            title="Archive Email Template"
            description="This is a soft delete. The template will be hidden from active CRM usage."
            onClose={() => setArchiveTarget(null)}
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                Archive <span className="font-semibold">{archiveTarget.name}</span>?
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setArchiveTarget(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={actingId === archiveTarget._id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {actingId === archiveTarget._id ? 'Archiving...' : 'Archive'}
                </button>
              </div>
            </div>
          </TemplateModal>
        ) : null}

        {previewTemplate ? (
          <TemplateModal
            title="Render Template Preview"
            description="Edit JSON variables and render the final email."
            onClose={closePreview}
            wide
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusBadge status={previewTemplate.status} />

                    {previewTemplate.isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                        <StarSolidIcon className="h-3.5 w-3.5" />
                        Default
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                    {previewTemplate.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {previewTemplate.subject}
                  </p>
                </div>

                <textarea
                  value={previewVariables}
                  onChange={(event) => setPreviewVariables(event.target.value)}
                  rows={16}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                />

                <Button onClick={handleRenderPreview} disabled={previewLoading}>
                  {previewLoading ? 'Rendering...' : 'Render Preview'}
                </Button>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Rendered Subject
                  </p>
                  <p className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    {previewResult?.subject || 'Render the template to see the final subject.'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Rendered Body
                  </p>
                  <pre className="mt-3 min-h-[340px] whitespace-pre-wrap text-sm leading-6 text-gray-700 dark:text-gray-300">
                    {previewResult?.bodyText || 'Rendered body will appear here.'}
                  </pre>
                </div>

                {previewResult?.bodyHtml ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Rendered HTML
                    </p>
                    <pre className="mt-3 max-h-60 overflow-auto whitespace-pre-wrap text-xs leading-5 text-gray-700 dark:text-gray-300">
                      {previewResult.bodyHtml}
                    </pre>
                  </div>
                ) : null}
              </div>
            </div>
          </TemplateModal>
        ) : null}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default dynamic(() => Promise.resolve(EmailTemplatesPage), {
  ssr: false,
});