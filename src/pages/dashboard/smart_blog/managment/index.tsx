import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import SmartBlogEditor from '@/components/editor/SmartBlogEditor';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';

type BlogStatus = 'draft' | 'published';

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
  status: BlogStatus;
  publishedAt?: string | null;
  generatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

type EditorForm = {
  title: string;
  slug: string;
  topic: string;
  audience: string;
  appName: string;
  excerpt: string;
  metaDescription: string;
  suggestedKeywordsText: string;
  sourceLinksText: string;
  coverImageUrl: string;
  coverImageSourcePage: string;
  coverImageQuery: string;
  coverImageAlt: string;
  contentHtml: string;
  contentMarkdown: string;
};

const EMPTY_EDITOR: EditorForm = {
  title: '',
  slug: '',
  topic: '',
  audience: '',
  appName: '',
  excerpt: '',
  metaDescription: '',
  suggestedKeywordsText: '',
  sourceLinksText: '',
  coverImageUrl: '',
  coverImageSourcePage: '',
  coverImageQuery: '',
  coverImageAlt: '',
  contentHtml: '',
  contentMarkdown: '',
};

function BlogsManagement() {
  const [serverError, setServerError] = useState('');
  const [blogs, setBlogs] = useState<AiBlogDoc[]>([]);
  const [selectedBlog, setSelectedBlog] = useState<AiBlogDoc | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | BlogStatus>('all');
  const [search, setSearch] = useState('');

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [editorForm, setEditorForm] = useState<EditorForm>(EMPTY_EDITOR);

  const hasSelectedBlog = Boolean(selectedBlog?._id);

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const matchesStatus =
        statusFilter === 'all' ? true : blog.status === statusFilter;

      const q = search.trim().toLowerCase();

      const matchesSearch = !q
        ? true
        : [
            blog.title,
            blog.slug,
            blog.topic,
            blog.excerpt,
            blog.audience,
            blog.appName,
            ...(blog.suggestedKeywords || []),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [blogs, search, statusFilter]);

  const mapDocToEditor = (doc: AiBlogDoc): EditorForm => ({
    title: doc.title || '',
    slug: doc.slug || '',
    topic: doc.topic || '',
    audience: doc.audience || '',
    appName: doc.appName || '',
    excerpt: doc.excerpt || '',
    metaDescription: doc.metaDescription || '',
    suggestedKeywordsText: Array.isArray(doc.suggestedKeywords)
      ? doc.suggestedKeywords.join(', ')
      : '',
    sourceLinksText: Array.isArray(doc.sourceLinks)
      ? doc.sourceLinks.join('\n')
      : '',
    coverImageUrl: doc.coverImage?.url || '',
    coverImageSourcePage: doc.coverImage?.sourcePage || '',
    coverImageQuery: doc.coverImage?.query || '',
    coverImageAlt: doc.coverImage?.alt || '',
    contentHtml: doc.contentHtml || '',
    contentMarkdown: doc.contentMarkdown || '',
  });

  const fetchBlogById = async (id: string) => {
    try {
      setIsLoadingDetails(true);
      setServerError('');

      const response = await api.get(`/ai-blogs/${id}`);
      const doc = response?.data?.data || null;

      setSelectedBlog(doc);

      if (doc) {
        setEditorForm(mapDocToEditor(doc));
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to fetch blog details.'
      );
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const fetchBlogs = async (preferredId?: string) => {
    try {
      setIsLoadingList(true);
      setServerError('');

      const response = await api.get('/ai-blogs', {
        params: { limit: 100 },
      });

      const items: AiBlogDoc[] = response?.data?.data?.items || [];
      setBlogs(items);

      const targetId =
        preferredId ||
        selectedBlog?._id ||
        items[0]?._id ||
        '';

      if (targetId) {
        await fetchBlogById(targetId);
      } else {
        setSelectedBlog(null);
        setEditorForm(EMPTY_EDITOR);
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to fetch blogs.'
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    fetchBlogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeEditorField = <K extends keyof EditorForm>(
    field: K,
    value: EditorForm[K]
  ) => {
    setEditorForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const buildPayload = () => ({
    title: editorForm.title.trim(),
    slug: editorForm.slug.trim(),
    topic: editorForm.topic.trim(),
    audience: editorForm.audience.trim(),
    appName: editorForm.appName.trim(),
    excerpt: editorForm.excerpt.trim(),
    metaDescription: editorForm.metaDescription.trim(),
    suggestedKeywords: editorForm.suggestedKeywordsText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    sourceLinks: editorForm.sourceLinksText
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean),
    coverImage: {
      url: editorForm.coverImageUrl.trim(),
      sourcePage: editorForm.coverImageSourcePage.trim(),
      query: editorForm.coverImageQuery.trim(),
      alt: editorForm.coverImageAlt.trim(),
    },
    contentHtml: editorForm.contentHtml,
    contentMarkdown: editorForm.contentMarkdown,
    editorData: {
      type: 'html',
      content: editorForm.contentHtml,
    },
  });

  const onSave = async () => {
    if (!selectedBlog?._id) return;

    try {
      setIsSaving(true);
      setServerError('');

      const response = await api.patch(
        `/ai-blogs/${selectedBlog._id}`,
        buildPayload()
      );

      const doc: AiBlogDoc | null = response?.data?.data || null;

      if (doc?._id) {
        await fetchBlogs(doc._id);
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to save blog.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const onPublishToggle = async () => {
    if (!selectedBlog?._id) return;

    try {
      setIsStatusLoading(true);
      setServerError('');

      if (selectedBlog.status === 'published') {
        await api.patch(`/ai-blogs/${selectedBlog._id}/unpublish`);
      } else {
        await api.patch(`/ai-blogs/${selectedBlog._id}/publish`);
      }

      await fetchBlogs(selectedBlog._id);
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to update blog status.'
      );
    } finally {
      setIsStatusLoading(false);
    }
  };

  const onDelete = async (id?: string) => {
    const targetId = id || selectedBlog?._id;
    if (!targetId) return;

    const confirmed = window.confirm('Delete this blog permanently?');
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      setServerError('');

      await api.delete(`/ai-blogs/${targetId}`);

      const nextBlogs = blogs.filter((item) => item._id !== targetId);
      setBlogs(nextBlogs);

      if (selectedBlog?._id === targetId) {
        if (nextBlogs.length > 0) {
          await fetchBlogById(nextBlogs[0]._id);
        } else {
          setSelectedBlog(null);
          setEditorForm(EMPTY_EDITOR);
        }
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to delete blog.'
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
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Blog Management
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  View, edit draft or published blogs, publish or unpublish them, and delete them.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={onSave}
                  isLoading={isSaving}
                  disabled={!hasSelectedBlog}
                >
                  {selectedBlog?.status === 'published'
                    ? 'Save Published Blog'
                    : 'Save Draft'}
                </Button>

                <Button
                  type="button"
                  onClick={onPublishToggle}
                  isLoading={isStatusLoading}
                  disabled={!hasSelectedBlog}
                >
                  {selectedBlog?.status === 'published'
                    ? 'Move to Draft'
                    : 'Publish'}
                </Button>

                <Button
                  type="button"
                  onClick={() => onDelete()}
                  isLoading={isDeleting}
                  disabled={!hasSelectedBlog}
                >
                  Delete
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
                  All Blogs
                </h2>

                <div className="mt-4 space-y-4">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search title, topic, keyword..."
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                  />

                  <div className="grid grid-cols-3 gap-2">
                    {(['all', 'draft', 'published'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={`rounded-xl px-3 py-2 text-sm capitalize ${
                          statusFilter === status
                            ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {isLoadingList && (
                    <div className="space-y-3">
                      <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                      <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                      <div className="h-20 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                    </div>
                  )}

                  {!isLoadingList && filteredBlogs.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      No blogs found.
                    </div>
                  )}

                  {!isLoadingList &&
                    filteredBlogs.map((blog) => {
                      const isActive = selectedBlog?._id === blog._id;

                      return (
                        <div
                          key={blog._id}
                          className={`rounded-2xl border p-4 transition ${
                            isActive
                              ? 'border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800/80'
                              : 'border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => fetchBlogById(blog._id)}
                            className="w-full text-left"
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
                                className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                  blog.status === 'published'
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

                          <div className="mt-4 flex gap-2">
                            <button
                              type="button"
                              onClick={() => fetchBlogById(blog._id)}
                              className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => onDelete(blog._id)}
                              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
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
                      Edit Blog
                    </h2>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Open any draft or published blog from the list and edit it here.
                    </p>
                  </div>

                  {selectedBlog && (
                    <div className="flex flex-wrap gap-2 text-xs">
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
                      Choose a blog from the left panel.
                    </p>
                  </div>
                )}

                {isLoadingDetails && (
                  <div className="mt-6 space-y-4">
                    <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                    <div className="h-12 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
                    <div className="h-24 animate-pulse rounded-2xl bg-gray-100 dark:bg-gray-800" />
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

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Slug
                      </label>
                      <input
                        type="text"
                        value={editorForm.slug}
                        onChange={(e) =>
                          onChangeEditorField('slug', e.target.value)
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
                          placeholder="keyword 1, keyword 2"
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                        />
                      </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Audience
                        </label>
                        <input
                          type="text"
                          value={editorForm.audience}
                          onChange={(e) =>
                            onChangeEditorField('audience', e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          App Name
                        </label>
                        <input
                          type="text"
                          value={editorForm.appName}
                          onChange={(e) =>
                            onChangeEditorField('appName', e.target.value)
                          }
                          className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Source Links
                      </label>
                      <textarea
                        rows={3}
                        value={editorForm.sourceLinksText}
                        onChange={(e) =>
                          onChangeEditorField('sourceLinksText', e.target.value)
                        }
                        placeholder="One URL per line"
                        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:focus:border-white"
                      />
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

              {hasSelectedBlog && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Preview
                  </h2>

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
                        dangerouslySetInnerHTML={{
                          __html: editorForm.contentHtml,
                        }}
                      />
                    </div>
                  </div>
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

export default BlogsManagement;