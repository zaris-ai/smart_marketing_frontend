import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import SmartBlogEditor from '@/components/editor/SmartBlogEditor';


type BlogStatus = 'draft' | 'published';

type ManualBlog = {
    _id: string;
    title: string;
    slug: string;
    topic: string;
    audience?: string;
    appName?: string;
    suggestedKeywords?: string[];
    metaDescription?: string;
    excerpt?: string;
    contentHtml: string;
    contentMarkdown?: string;
    status: BlogStatus;
    coverImage?: {
        url?: string;
        sourcePage?: string;
        query?: string;
        alt?: string;
    };
    createdAt?: string;
    updatedAt?: string;
    publishedAt?: string | null;
};

type ManualBlogForm = {
    title: string;
    slug: string;
    topic: string;
    audience: string;
    appName: string;
    keywordsText: string;
    metaDescription: string;
    excerpt: string;
    coverImageUrl: string;
    coverImageSourcePage: string;
    coverImageQuery: string;
    coverImageAlt: string;
    contentHtml: string;
};

const emptyForm: ManualBlogForm = {
    title: '',
    slug: '',
    topic: '',
    audience: 'Shopify merchants',
    appName: 'Arka: Smart Analyzer',
    keywordsText: '',
    metaDescription: '',
    excerpt: '',
    coverImageUrl: '',
    coverImageSourcePage: '',
    coverImageQuery: '',
    coverImageAlt: '',
    contentHtml: '',
};

function ManualBlogCreatePage() {
    const [form, setForm] = useState<ManualBlogForm>(emptyForm);
    const [blogs, setBlogs] = useState<ManualBlog[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [loadingBlogs, setLoadingBlogs] = useState(false);
    const [saving, setSaving] = useState(false);

    const isEditing = Boolean(editingId);

    const parsedKeywords = useMemo(() => {
        return form.keywordsText
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
    }, [form.keywordsText]);

    const updateForm = <K extends keyof ManualBlogForm>(
        key: K,
        value: ManualBlogForm[K]
    ) => {
        setForm((previous) => ({
            ...previous,
            [key]: value,
        }));
    };

    const fetchBlogs = async () => {
        setLoadingBlogs(true);

        try {
            const response = await api.get('/manual-blogs', {
                params: {
                    limit: 20,
                },
            });

            setBlogs(response.data?.blogs || []);
        } catch (error: any) {
            toast.error(
                error?.response?.data?.message || 'Failed to load manual blogs'
            );
        } finally {
            setLoadingBlogs(false);
        }
    };

    useEffect(() => {
        fetchBlogs();
    }, []);

    const buildPayload = (status: BlogStatus) => ({
        title: form.title.trim(),
        slug: form.slug.trim(),
        topic: form.topic.trim(),
        audience: form.audience.trim() || 'Shopify merchants',
        appName: form.appName.trim() || 'Arka: Smart Analyzer',
        suggestedKeywords: parsedKeywords,
        metaDescription: form.metaDescription.trim(),
        excerpt: form.excerpt.trim(),
        contentHtml: form.contentHtml,
        contentMarkdown: '',
        editorData: null,
        status,
        coverImage: {
            url: form.coverImageUrl.trim(),
            sourcePage: form.coverImageSourcePage.trim(),
            query: form.coverImageQuery.trim(),
            alt: form.coverImageAlt.trim(),
        },
    });

    const validateBeforeSave = () => {
        if (!form.title.trim()) {
            toast.error('Title is required');
            return false;
        }

        if (!form.topic.trim()) {
            toast.error('Topic is required');
            return false;
        }

        if (!form.contentHtml || form.contentHtml === '<p></p>') {
            toast.error('Blog content is required');
            return false;
        }

        return true;
    };

    const saveBlog = async (status: BlogStatus) => {
        if (!validateBeforeSave()) return;

        setSaving(true);

        try {
            const payload = buildPayload(status);

            const response = editingId
                ? await api.patch(`/manual-blogs/${editingId}`, payload)
                : await api.post('/manual-blogs', payload);

            const savedBlog = response.data?.blog;

            toast.success(
                status === 'published'
                    ? 'Blog published successfully'
                    : 'Blog saved as draft'
            );

            if (savedBlog?._id) {
                setEditingId(savedBlog._id);
            }

            await fetchBlogs();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to save blog');
        } finally {
            setSaving(false);
        }
    };

    const loadBlogForEdit = (blog: ManualBlog) => {
        setEditingId(blog._id);

        setForm({
            title: blog.title || '',
            slug: blog.slug || '',
            topic: blog.topic || '',
            audience: blog.audience || 'Shopify merchants',
            appName: blog.appName || 'Arka: Smart Analyzer',
            keywordsText: (blog.suggestedKeywords || []).join(', '),
            metaDescription: blog.metaDescription || '',
            excerpt: blog.excerpt || '',
            coverImageUrl: blog.coverImage?.url || '',
            coverImageSourcePage: blog.coverImage?.sourcePage || '',
            coverImageQuery: blog.coverImage?.query || '',
            coverImageAlt: blog.coverImage?.alt || '',
            contentHtml: blog.contentHtml || '',
        });

        window.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    };

    const resetForm = () => {
        setEditingId(null);
        setForm(emptyForm);
    };

    const deleteBlog = async (blogId: string) => {
        const confirmed = window.confirm('Delete this manual blog?');

        if (!confirmed) return;

        try {
            await api.delete(`/manual-blogs/${blogId}`);

            toast.success('Blog deleted successfully');

            if (editingId === blogId) {
                resetForm();
            }

            await fetchBlogs();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Failed to delete blog');
        }
    };

    return (
        <DashboardLayout>
            <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            Manual Blog Writer
                        </h1>

                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                            Write, save, edit, and publish blog posts directly without running
                            any AI crew.
                        </p>
                    </div>

                    <Button type="button" onClick={resetForm} disabled={saving}>
                        New Blog
                    </Button>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                    <div className="mb-5 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                {isEditing ? 'Edit Manual Blog' : 'Create Manual Blog'}
                            </h2>

                            {editingId && (
                                <p className="mt-1 text-xs text-gray-500">
                                    Editing ID: {editingId}
                                </p>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                type="button"
                                onClick={() => saveBlog('draft')}
                                disabled={saving}
                            >
                                Save Draft
                            </Button>

                            <Button
                                type="button"
                                onClick={() => saveBlog('published')}
                                disabled={saving}
                            >
                                Publish
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Title
                            </label>
                            <input
                                value={form.title}
                                onChange={(event) => updateForm('title', event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Blog title"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Slug
                            </label>
                            <input
                                value={form.slug}
                                onChange={(event) => updateForm('slug', event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Leave empty to generate automatically"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Topic
                            </label>
                            <input
                                value={form.topic}
                                onChange={(event) => updateForm('topic', event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Shopify analytics, reporting, products..."
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Audience
                            </label>
                            <input
                                value={form.audience}
                                onChange={(event) => updateForm('audience', event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Shopify merchants"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                App Name
                            </label>
                            <input
                                value={form.appName}
                                onChange={(event) => updateForm('appName', event.target.value)}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Arka: Smart Analyzer"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Keywords
                            </label>
                            <input
                                value={form.keywordsText}
                                onChange={(event) =>
                                    updateForm('keywordsText', event.target.value)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="shopify analytics, sales reports, product insights"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Meta Description
                            </label>
                            <textarea
                                value={form.metaDescription}
                                onChange={(event) =>
                                    updateForm('metaDescription', event.target.value)
                                }
                                rows={2}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="SEO meta description"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Excerpt
                            </label>
                            <textarea
                                value={form.excerpt}
                                onChange={(event) => updateForm('excerpt', event.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Short blog summary"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Cover Image URL
                            </label>
                            <input
                                value={form.coverImageUrl}
                                onChange={(event) =>
                                    updateForm('coverImageUrl', event.target.value)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="https://..."
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Cover Image Alt
                            </label>
                            <input
                                value={form.coverImageAlt}
                                onChange={(event) =>
                                    updateForm('coverImageAlt', event.target.value)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Descriptive image alt text"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Source Page
                            </label>
                            <input
                                value={form.coverImageSourcePage}
                                onChange={(event) =>
                                    updateForm('coverImageSourcePage', event.target.value)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Image source page"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Search Query
                            </label>
                            <input
                                value={form.coverImageQuery}
                                onChange={(event) =>
                                    updateForm('coverImageQuery', event.target.value)
                                }
                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm outline-none focus:border-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                                placeholder="Image search query"
                            />
                        </div>
                    </div>

                    <div className="mt-6">
                        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Blog Content
                        </label>

                        <SmartBlogEditor
                            value={form.contentHtml}
                            onChange={(html) => updateForm('contentHtml', html)}
                            placeholder="Write your blog content here..."
                        />
                    </div>

                    <div className="mt-6 flex flex-wrap justify-end gap-2">
                        <Button type="button" onClick={resetForm} disabled={saving}>
                            Clear
                        </Button>

                        <Button
                            type="button"
                            onClick={() => saveBlog('draft')}
                            disabled={saving}
                        >
                            Save Draft
                        </Button>

                        <Button
                            type="button"
                            onClick={() => saveBlog('published')}
                            disabled={saving}
                        >
                            Publish
                        </Button>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                Previous Manual Blogs
                            </h2>

                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                Drafts and published manual posts.
                            </p>
                        </div>

                        <Button type="button" onClick={fetchBlogs} disabled={loadingBlogs}>
                            Refresh
                        </Button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800">
                                    <th className="px-3 py-3">Title</th>
                                    <th className="px-3 py-3">Slug</th>
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Updated</th>
                                    <th className="px-3 py-3 text-right">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {blogs.map((blog) => (
                                    <tr
                                        key={blog._id}
                                        className="border-b border-gray-100 dark:border-gray-800"
                                    >
                                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-white">
                                            {blog.title}
                                        </td>

                                        <td className="px-3 py-3 text-gray-500">{blog.slug}</td>

                                        <td className="px-3 py-3">
                                            <span
                                                className={
                                                    blog.status === 'published'
                                                        ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                                                        : 'rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700'
                                                }
                                            >
                                                {blog.status}
                                            </span>
                                        </td>

                                        <td className="px-3 py-3 text-gray-500">
                                            {blog.updatedAt
                                                ? new Date(blog.updatedAt).toLocaleString()
                                                : '-'}
                                        </td>

                                        <td className="px-3 py-3">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    type="button"
                                                    onClick={() => loadBlogForEdit(blog)}
                                                >
                                                    Edit
                                                </Button>

                                                <Button
                                                    type="button"
                                                    onClick={() => deleteBlog(blog._id)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {!blogs.length && (
                                    <tr>
                                        <td
                                            colSpan={5}
                                            className="px-3 py-8 text-center text-gray-500"
                                        >
                                            {loadingBlogs
                                                ? 'Loading manual blogs...'
                                                : 'No manual blogs yet.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

export default ManualBlogCreatePage;