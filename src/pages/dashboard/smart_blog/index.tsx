import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { saveAs } from 'file-saver';
import { useEffect, useMemo, useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';

const SmartBlogEditor = dynamic(
  () => import('@/components/editor/SmartBlogEditor'),
  {
    ssr: false,
  }
);

type RunStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failed'
  | 'cancelled'
  | 'canceled';

type BackgroundRun = {
  _id: string;
  crewName: string;
  title?: string;
  status: RunStatus;
  error?: {
    message?: string;
    stack?: string;
  };
  savedRecord?: {
    model?: string | null;
    id?: string | null;
  } | null;
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

type AiBlogDoc = {
  _id: string;
  title: string;
  slug: string;
  topic: string;
  audience: string;
  appName: string;
  sourceLinks: string[];
  suggestedKeywords: string[];
  metaDescription: string;
  excerpt: string;
  coverImage?: {
    url?: string;
    sourcePage?: string;
    query?: string;
    alt?: string;
  };
  contentHtml: string;
  contentMarkdown?: string;
  editorData?: {
    type?: string;
    content?: string;
  } | null;
  crewName: string;
  status: 'draft' | 'published';
  publishedAt?: string | null;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

const SOURCE_LINKS = [
  'https://web.arkaanalyzer.com/',
  'https://apps.shopify.com/arka-smart-analyzer',
];

const EMPTY_EDITOR = {
  title: '',
  topic: '',
  excerpt: '',
  metaDescription: '',
  suggestedKeywordsText: '',
  coverImageUrl: '',
  coverImageSourcePage: '',
  coverImageQuery: '',
  coverImageAlt: '',
  contentHtml: '',
  contentMarkdown: '',
};

function slugify(value: string) {
  return (value || 'smart-blog')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function extractRunFromResponse(response: any): BackgroundRun | null {
  return (
    response?.data?.data?.run ||
    response?.data?.run ||
    response?.data?.data ||
    null
  );
}

function htmlToDocxParagraphs(html: string): Paragraph[] {
  if (!html?.trim()) return [];

  const parser = new DOMParser();
  const parsed = parser.parseFromString(html, 'text/html');
  const body = parsed.body;
  const paragraphs: Paragraph[] = [];

  const pushTextParagraph = (
    text: string,
    options?: {
      bold?: boolean;
      size?: number;
      spacing?: { before?: number; after?: number };
      italics?: boolean;
    }
  ) => {
    const content = cleanText(text);
    if (!content) return;

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: content,
            bold: options?.bold,
            italics: options?.italics,
            size: options?.size,
          }),
        ],
        spacing: options?.spacing || { after: 120 },
      })
    );
  };

  const walk = (element: Element) => {
    const tag = element.tagName.toLowerCase();

    if (tag === 'h1') {
      pushTextParagraph(element.textContent || '', {
        bold: true,
        size: 32,
        spacing: { before: 320, after: 180 },
      });
      return;
    }

    if (tag === 'h2') {
      pushTextParagraph(element.textContent || '', {
        bold: true,
        size: 28,
        spacing: { before: 280, after: 140 },
      });
      return;
    }

    if (tag === 'h3') {
      pushTextParagraph(element.textContent || '', {
        bold: true,
        size: 24,
        spacing: { before: 240, after: 120 },
      });
      return;
    }

    if (tag === 'p' || tag === 'li' || tag === 'blockquote') {
      pushTextParagraph(element.textContent || '', {
        spacing: { after: 120 },
      });
      return;
    }

    if (['div', 'section', 'article', 'main'].includes(tag)) {
      Array.from(element.children).forEach((child) => walk(child));
      return;
    }

    const text = cleanText(element.textContent);
    if (text) {
      pushTextParagraph(text, {
        spacing: { after: 100 },
      });
    }
  };

  Array.from(body.children).forEach((child) => walk(child));

  return paragraphs;
}

function SmartBlog() {
  const router = useRouter();

  const [serverError, setServerError] = useState('');
  const [blogs, setBlogs] = useState<AiBlogDoc[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<AiBlogDoc | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);
  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus | ''>('');

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editorForm, setEditorForm] = useState(EMPTY_EDITOR);

  const hasSelectedBlog = useMemo(() => !!selectedBlog?._id, [selectedBlog]);
  const previewHtml = useMemo(
    () => editorForm.contentHtml?.trim() || '',
    [editorForm.contentHtml]
  );
  const hasPreview = useMemo(() => previewHtml.length > 0, [previewHtml]);

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';
    if (runStatus === 'cancelled') return 'Cancelled';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

  const hydrateEditor = (doc: AiBlogDoc) => {
    setSelectedBlog(doc);

    setEditorForm({
      title: doc.title || '',
      topic: doc.topic || '',
      excerpt: doc.excerpt || '',
      metaDescription: doc.metaDescription || '',
      suggestedKeywordsText: Array.isArray(doc.suggestedKeywords)
        ? doc.suggestedKeywords.join(', ')
        : '',
      coverImageUrl: doc.coverImage?.url || '',
      coverImageSourcePage: doc.coverImage?.sourcePage || '',
      coverImageQuery: doc.coverImage?.query || '',
      coverImageAlt: doc.coverImage?.alt || '',
      contentHtml: doc.contentHtml || '',
      contentMarkdown: doc.contentMarkdown || '',
    });
  };

  const fetchBlogById = async (id: string) => {
    try {
      setIsLoadingDetails(true);
      setServerError('');

      const response = await api.get(`/ai-blogs/${id}`);
      const doc = response?.data?.data || null;

      if (doc) {
        hydrateEditor(doc);
      }
    } catch (error: any) {
      setServerError(getErrorMessage(error, 'Failed to fetch blog details.'));
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const fetchBlogs = async (preferredId?: string) => {
    try {
      setIsLoadingList(true);
      setServerError('');

      const response = await api.get('/ai-blogs', {
        params: { limit: 50 },
      });

      const items = response?.data?.data?.items || [];
      setBlogs(items);

      if (preferredId) {
        await fetchBlogById(preferredId);
        return;
      }

      if (!selectedBlog && items.length > 0) {
        await fetchBlogById(items[0]._id);
      }
    } catch (error: any) {
      setServerError(getErrorMessage(error, 'Failed to fetch blogs.'));
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${runId}`);
        const run = extractRunFromResponse(response);

        if (!run) return;

        setRunStatus(run.status);

        if (run.status === 'success') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          const savedBlogId = run.savedRecord?.id || '';

          await fetchBlogs(savedBlogId || undefined);

          if (savedBlogId) {
            toast.success('AI blog draft generated and saved.');
          } else {
            toast.warning(
              'Blog generation completed, but saved blog ID was not attached to the background run.'
            );
          }

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          const message =
            run?.error?.message || 'AI blog background generation failed.';

          setServerError(message);
          toast.error(message);

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'cancelled') {
          clearInterval(timer);

          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          setServerError('AI blog generation was cancelled.');
          toast.error('AI blog generation was cancelled.');

          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);

        setIsBackgroundRunning(false);
        setIsSubmitting(false);

        const message = getErrorMessage(
          error,
          'AI blog generation completed, but the result could not be loaded.'
        );

        setServerError(message);
        toast.error(message);

        setRunId('');
        setRunStatus('');
      }
    }, 4000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const onChangeEditorField = (field: keyof typeof EMPTY_EDITOR, value: any) => {
    setEditorForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const onRunCrew = async () => {
    try {
      setIsSubmitting(true);
      setServerError('');

      const response = await api.post('/ai-blogs', {
        links: SOURCE_LINKS,
      });

      const run = extractRunFromResponse(response);

      if (!run?._id) {
        const message =
          response?.data?.message ||
          'AI blog generation was queued, but backend did not return a run ID.';

        setServerError(message);
        toast.error(message);
        setIsSubmitting(false);
        return;
      }

      setRunId(run._id);
      setRunStatus(run.status || 'queued');
      setIsBackgroundRunning(true);

      toast.success('AI blog generation started in background.');
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to queue AI blog generation.');

      setServerError(message);
      toast.error(message);
      setIsSubmitting(false);
      setIsBackgroundRunning(false);
    }
  };

  const onCancelRun = async () => {
    if (!runId) return;

    try {
      setServerError('');

      await api.patch(`/background-runs/${runId}/cancel`);

      setRunStatus('cancelled');
      setIsBackgroundRunning(false);
      setIsSubmitting(false);
      setServerError('AI blog generation was cancelled.');
      toast.error('AI blog generation was cancelled.');

      setRunId('');
    } catch (error: any) {
      const message = getErrorMessage(
        error,
        'Failed to stop AI blog generation.'
      );

      setServerError(message);
      toast.error(message);
    }
  };

  const onSaveDraft = async () => {
    if (!selectedBlog?._id) return;

    try {
      setIsSaving(true);
      setServerError('');

      const payload = {
        title: editorForm.title,
        topic: editorForm.topic,
        excerpt: editorForm.excerpt,
        metaDescription: editorForm.metaDescription,
        suggestedKeywords: editorForm.suggestedKeywordsText
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        coverImage: {
          url: editorForm.coverImageUrl,
          sourcePage: editorForm.coverImageSourcePage,
          query: editorForm.coverImageQuery,
          alt: editorForm.coverImageAlt,
        },
        contentHtml: editorForm.contentHtml,
        contentMarkdown: editorForm.contentMarkdown,
        editorData: {
          type: 'html',
          content: editorForm.contentHtml,
        },
      };

      const response = await api.patch(`/ai-blogs/${selectedBlog._id}`, payload);
      const doc = response?.data?.data || null;

      if (doc?._id) {
        await fetchBlogs(doc._id);
        toast.success('Draft saved.');
      }
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to save draft.');

      setServerError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onPublish = async () => {
    if (!selectedBlog?._id) return;

    try {
      setIsStatusLoading(true);
      setServerError('');

      await api.patch(`/ai-blogs/${selectedBlog._id}/publish`);
      await fetchBlogs(selectedBlog._id);

      toast.success('Blog published.');
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to publish blog.');

      setServerError(message);
      toast.error(message);
    } finally {
      setIsStatusLoading(false);
    }
  };

  const onUnpublish = async () => {
    if (!selectedBlog?._id) return;

    try {
      setIsStatusLoading(true);
      setServerError('');

      await api.patch(`/ai-blogs/${selectedBlog._id}/unpublish`);
      await fetchBlogs(selectedBlog._id);

      toast.success('Blog moved back to draft.');
    } catch (error: any) {
      const message = getErrorMessage(
        error,
        'Failed to move blog back to draft.'
      );

      setServerError(message);
      toast.error(message);
    } finally {
      setIsStatusLoading(false);
    }
  };

  const onDelete = async () => {
    if (!selectedBlog?._id) return;

    const confirmed = window.confirm('Delete this blog permanently?');
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setServerError('');

      const deletingId = selectedBlog._id;
      await api.delete(`/ai-blogs/${deletingId}`);

      const remaining = blogs.filter((item) => item._id !== deletingId);
      setBlogs(remaining);

      if (remaining.length > 0) {
        await fetchBlogById(remaining[0]._id);
      } else {
        setSelectedBlog(null);
        setEditorForm(EMPTY_EDITOR);
      }

      toast.success('Blog deleted.');
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to delete blog.');

      setServerError(message);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const downloadDOCX = async () => {
    if (!previewHtml.trim()) return;

    const title = editorForm.title || selectedBlog?.title || 'Smart Blog';

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: title,
                  bold: true,
                  size: 34,
                }),
              ],
              spacing: { after: 220 },
            }),
            ...htmlToDocxParagraphs(previewHtml),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${slugify(title)}.docx`);
  };

  const isBusyGenerating = isSubmitting || isBackgroundRunning;

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Smart Blog Generator
                </h1>

                <p className="mt-2 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
                  The system reads the project links, decides the best blog topic and title, generates a professional draft, and saves it to the database.
                </p>

                {isBackgroundRunning && (
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm" />
                      <span>
                        Blog generation is running in background. Status:{' '}
                        <strong>{runStatusLabel}</strong>
                      </span>
                    </div>

                    {runId && (
                      <div className="mt-2 break-all font-mono text-xs opacity-80">
                        Run ID: {runId}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {isBackgroundRunning && (
                  <Button type="button" onClick={onCancelRun}>
                    Stop Task
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={onRunCrew}
                  isLoading={isBusyGenerating}
                  disabled={isBusyGenerating}
                >
                  {isBackgroundRunning
                    ? 'Generating in Background...'
                    : 'Generate New Draft'}
                </Button>

                <Button
                  type="button"
                  onClick={onSaveDraft}
                  isLoading={isSaving}
                  disabled={!hasSelectedBlog || isSaving}
                >
                  Save Draft
                </Button>

                <Button
                  type="button"
                  onClick={
                    selectedBlog?.status === 'published'
                      ? onUnpublish
                      : onPublish
                  }
                  isLoading={isStatusLoading}
                  disabled={!hasSelectedBlog || isStatusLoading}
                >
                  {selectedBlog?.status === 'published'
                    ? 'Move to Draft'
                    : 'Publish'}
                </Button>

                <Button
                  type="button"
                  onClick={downloadDOCX}
                  disabled={!hasPreview || isLoadingDetails}
                >
                  Download Word
                </Button>

                <Button
                  type="button"
                  onClick={onDelete}
                  isLoading={isDeleting}
                  disabled={!hasSelectedBlog || isDeleting}
                >
                  Delete
                </Button>

                <Button
                  type="button"
                  onClick={() => router.push('/dashboard/smart_blog/managment')}
                >
                  Manage Blogs
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
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Source Links
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The topic and title are decided automatically from these pages.
                </p>

                <div className="mt-5 space-y-3">
                  {SOURCE_LINKS.map((link) => (
                    <a
                      key={link}
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-xl border border-gray-200 px-4 py-3 text-sm text-blue-600 hover:bg-gray-50 dark:border-gray-800 dark:text-blue-400 dark:hover:bg-gray-800/60"
                    >
                      {link}
                    </a>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Saved Blogs
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Open any saved draft or published blog.
                    </p>
                  </div>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {blogs.length}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  {isLoadingList && (
                    <div className="space-y-3">
                      <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                      <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                    </div>
                  )}

                  {!isLoadingList && blogs.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No blogs saved yet.
                    </div>
                  )}

                  {!isLoadingList &&
                    blogs.map((blog) => {
                      const isActive = selectedBlog?._id === blog._id;

                      return (
                        <button
                          key={blog._id}
                          type="button"
                          onClick={() => fetchBlogById(blog._id)}
                          className={`w-full rounded-2xl border p-4 text-left transition ${isActive
                            ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800/80'
                            : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800/60'
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {blog.title || 'Untitled Blog'}
                              </h3>

                              <p className="mt-1 truncate text-xs text-gray-500 dark:text-gray-400">
                                {blog.slug}
                              </p>
                            </div>

                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${blog.status === 'published'
                                ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'
                                }`}
                            >
                              {blog.status}
                            </span>
                          </div>

                          <p className="mt-3 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                            {blog.excerpt || blog.topic || 'No summary available'}
                          </p>

                          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
                            Updated: {new Date(blog.updatedAt).toLocaleString()}
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
                      Blog Editor
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Review and edit the auto-generated draft before publishing.
                    </p>
                  </div>

                  {selectedBlog && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {selectedBlog.status}
                      </span>

                      <span className="rounded-full bg-gray-100 px-3 py-1 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {selectedBlog.crewName}
                      </span>
                    </div>
                  )}
                </div>

                {!hasSelectedBlog && !isLoadingDetails && (
                  <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No blog selected
                    </h3>

                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                      Generate a draft or open one from the saved list.
                    </p>
                  </div>
                )}

                {isLoadingDetails && (
                  <div className="mt-6 space-y-4">
                    <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                    <div className="h-80 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                  </div>
                )}

                {hasSelectedBlog && !isLoadingDetails && (
                  <div className="mt-6 space-y-5">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Title
                      </label>

                      <input
                        type="text"
                        value={editorForm.title}
                        onChange={(e) =>
                          onChangeEditorField('title', e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Topic
                        </label>

                        <input
                          type="text"
                          value={editorForm.topic}
                          onChange={(e) =>
                            onChangeEditorField('topic', e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Keywords
                        </label>

                        <input
                          type="text"
                          value={editorForm.suggestedKeywordsText}
                          onChange={(e) =>
                            onChangeEditorField(
                              'suggestedKeywordsText',
                              e.target.value
                            )
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Excerpt
                      </label>

                      <textarea
                        rows={4}
                        value={editorForm.excerpt}
                        onChange={(e) =>
                          onChangeEditorField('excerpt', e.target.value)
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Meta Description
                      </label>

                      <textarea
                        rows={3}
                        value={editorForm.metaDescription}
                        onChange={(e) =>
                          onChangeEditorField(
                            'metaDescription',
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                      />
                    </div>

                    <div className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Cover Image
                      </h3>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Image URL
                          </label>

                          <input
                            type="text"
                            value={editorForm.coverImageUrl}
                            onChange={(e) =>
                              onChangeEditorField(
                                'coverImageUrl',
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Source Page
                          </label>

                          <input
                            type="text"
                            value={editorForm.coverImageSourcePage}
                            onChange={(e) =>
                              onChangeEditorField(
                                'coverImageSourcePage',
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Search Query
                          </label>

                          <input
                            type="text"
                            value={editorForm.coverImageQuery}
                            onChange={(e) =>
                              onChangeEditorField(
                                'coverImageQuery',
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Alt Text
                          </label>

                          <input
                            type="text"
                            value={editorForm.coverImageAlt}
                            onChange={(e) =>
                              onChangeEditorField(
                                'coverImageAlt',
                                e.target.value
                              )
                            }
                            className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Content
                      </label>

                      <SmartBlogEditor
                        value={editorForm.contentHtml}
                        onChange={(html) =>
                          onChangeEditorField('contentHtml', html)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Preview
                </h2>

                {!hasPreview && (
                  <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      No preview available
                    </h3>
                  </div>
                )}

                {hasPreview && (
                  <div className="mt-5 space-y-5">
                    {editorForm.coverImageUrl && (
                      <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
                        <img
                          src={editorForm.coverImageUrl}
                          alt={
                            editorForm.coverImageAlt ||
                            editorForm.title ||
                            'Blog image'
                          }
                          className="h-72 w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="rounded-2xl border border-gray-200 p-6 dark:border-gray-800">
                      <article
                        className="prose prose-gray max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();

export default SmartBlog;