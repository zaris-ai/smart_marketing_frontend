import dynamic from 'next/dynamic';
import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';

const SmartBlogEditor = dynamic(() => import('@/components/editor/SmartBlogEditor'), {
  ssr: false,
});

type BlogCrewFormData = {
  title: string;
  topic: string;
  audience: string;
  tone: string;
  keywords: string;
};

type AiBlogDoc = {
  _id: string;
  title: string;
  slug: string;
  topic: string;
  audience: string;
  sourceLinks?: string[];
  suggestedKeywords: string[];
  metaDescription: string;
  excerpt: string;
  contentHtml: string;
  contentMarkdown: string;
  status: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
};

function splitKeywords(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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

function extractBlogFromResponse(response: any): AiBlogDoc | null {
  const data = response?.data;

  const blog =
    data?.data?.blog ||
    data?.blog ||
    data?.data?.item ||
    data?.item ||
    null;

  if (blog) return blog;

  const legacyData = data?.data;

  if (!legacyData) return null;

  const html =
    legacyData?.contentHtml ||
    legacyData?.result?.html ||
    legacyData?.html ||
    '';

  const markdown =
    legacyData?.contentMarkdown ||
    legacyData?.content ||
    legacyData?.result?.content ||
    '';

  if (!html && !markdown) return null;

  return {
    _id: legacyData?._id || legacyData?.id || '',
    title: legacyData?.title || 'Untitled blog',
    slug: legacyData?.slug || '',
    topic: legacyData?.topic || '',
    audience: legacyData?.audience || '',
    sourceLinks: legacyData?.sourceLinks || [],
    suggestedKeywords: legacyData?.suggestedKeywords || [],
    metaDescription: legacyData?.metaDescription || '',
    excerpt: legacyData?.excerpt || '',
    contentHtml: html,
    contentMarkdown: markdown,
    status: legacyData?.status || 'draft',
    createdAt: legacyData?.createdAt,
    updatedAt: legacyData?.updatedAt,
  };
}

function hasRealMongoId(value?: string) {
  return Boolean(value && /^[a-f\d]{24}$/i.test(value));
}

const BlogPage = () => {
  const [serverError, setServerError] = useState('');
  const [blog, setBlog] = useState<AiBlogDoc | null>(null);
  const [editorHtml, setEditorHtml] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editableTitle, setEditableTitle] = useState('');
  const [editableMetaDescription, setEditableMetaDescription] = useState('');
  const [editableExcerpt, setEditableExcerpt] = useState('');
  const [editableKeywords, setEditableKeywords] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlogCrewFormData>({
    defaultValues: {
      title: '',
      topic: '',
      audience: 'founder',
      tone: 'direct and practical',
      keywords: '',
    },
  });

  const hydrateEditorFromBlog = (nextBlog: AiBlogDoc) => {
    setBlog(nextBlog);
    setEditorHtml(nextBlog.contentHtml || '');
    setEditableTitle(nextBlog.title || '');
    setEditableMetaDescription(nextBlog.metaDescription || '');
    setEditableExcerpt(nextBlog.excerpt || '');
    setEditableKeywords((nextBlog.suggestedKeywords || []).join(', '));
  };

  const onSubmit = async (data: BlogCrewFormData) => {
    const toastId = toast.loading('Blog crew is running...');

    try {
      setServerError('');
      setBlog(null);
      setEditorHtml('');

      const response = await api.post('/blogs', {
        title: data.title.trim(),
        topic: data.topic.trim(),
        audience: data.audience.trim(),
        tone: data.tone.trim(),
        keywords: splitKeywords(data.keywords),
      });

      console.log('BLOG CREATE RESPONSE:', response.data);

      const createdBlog = extractBlogFromResponse(response);

      if (!createdBlog) {
        throw new Error(
          'API did not return a blog document or blog content.'
        );
      }

      hydrateEditorFromBlog(createdBlog);

      if (!hasRealMongoId(createdBlog._id)) {
        toast.warning(
          'Blog generated, but backend did not return a real MongoDB _id. Save and publish will not work until backend returns data.blog._id.',
          { id: toastId }
        );
        return;
      }

      toast.success('Blog generated and saved as draft.', {
        id: toastId,
      });
    } catch (error: any) {
      console.log(error);

      const message = getErrorMessage(error, 'Failed to run blog crew.');

      setServerError(message);

      toast.error(message, {
        id: toastId,
      });
    }
  };

  const handleSaveBlog = async () => {
    if (!blog) {
      toast.error('No blog selected to save.');
      return;
    }

    if (!hasRealMongoId(blog._id)) {
      toast.error('Cannot save. Backend did not return a valid MongoDB blog _id.');
      return;
    }

    const toastId = toast.loading('Saving blog changes...');

    try {
      setIsSaving(true);
      setServerError('');

      const response = await api.patch(`/blogs/${blog._id}`, {
        title: editableTitle.trim(),
        metaDescription: editableMetaDescription.trim(),
        excerpt: editableExcerpt.trim(),
        suggestedKeywords: splitKeywords(editableKeywords),
        contentHtml: editorHtml,
        editorData: {
          format: 'html',
          source: 'SmartBlogEditor',
          html: editorHtml,
          savedAt: new Date().toISOString(),
        },
      });

      const updatedBlog = extractBlogFromResponse(response);

      if (!updatedBlog) {
        throw new Error('API did not return updated blog document.');
      }

      hydrateEditorFromBlog(updatedBlog);

      toast.success('Blog saved successfully.', {
        id: toastId,
      });
    } catch (error: any) {
      console.log(error);

      const message = getErrorMessage(error, 'Failed to save blog.');

      setServerError(message);

      toast.error(message, {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishBlog = async () => {
    if (!blog) {
      toast.error('No blog selected to publish.');
      return;
    }

    if (!hasRealMongoId(blog._id)) {
      toast.error('Cannot publish. Backend did not return a valid MongoDB blog _id.');
      return;
    }

    const toastId = toast.loading('Publishing blog...');

    try {
      setIsSaving(true);
      setServerError('');

      const response = await api.patch(`/blogs/${blog._id}`, {
        title: editableTitle.trim(),
        metaDescription: editableMetaDescription.trim(),
        excerpt: editableExcerpt.trim(),
        suggestedKeywords: splitKeywords(editableKeywords),
        contentHtml: editorHtml,
        editorData: {
          format: 'html',
          source: 'SmartBlogEditor',
          html: editorHtml,
          savedAt: new Date().toISOString(),
        },
        status: 'published',
      });

      const updatedBlog = extractBlogFromResponse(response);

      if (!updatedBlog) {
        throw new Error('API did not return published blog document.');
      }

      hydrateEditorFromBlog(updatedBlog);

      toast.success('Blog saved and published.', {
        id: toastId,
      });
    } catch (error: any) {
      console.log(error);

      const message = getErrorMessage(error, 'Failed to publish blog.');

      setServerError(message);

      toast.error(message, {
        id: toastId,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const canPersistBlog = hasRealMongoId(blog?._id);

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Blog Crew Runner
            </h1>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Generate a blog with title and keywords, then edit and save it.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {serverError}
              </div>
            )}

            <Input
              {...register('title')}
              type="text"
              label="Title"
              placeholder="Optional. Leave empty and the crew will generate it."
              error={errors.title?.message}
              dir="ltr"
              autoFocus
            />

            <Input
              {...register('topic', {
                required: 'Topic is required',
                minLength: {
                  value: 5,
                  message: 'Topic must be at least 5 characters',
                },
              })}
              type="text"
              label="Topic"
              placeholder="How should a SaaS startup price an analytics product?"
              error={errors.topic?.message}
              dir="ltr"
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Keywords
              </label>

              <textarea
                {...register('keywords')}
                rows={3}
                placeholder="analytics dashboard, Shopify analytics, product performance"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                dir="ltr"
              />

              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Separate keywords with comma or new line.
              </p>
            </div>

            <Input
              {...register('audience', {
                required: 'Audience is required',
              })}
              type="text"
              label="Audience"
              placeholder="founder"
              error={errors.audience?.message}
              dir="ltr"
            />

            <Input
              {...register('tone', {
                required: 'Tone is required',
              })}
              type="text"
              label="Tone"
              placeholder="direct and practical"
              error={errors.tone?.message}
              dir="ltr"
            />

            <Button type="submit" isLoading={isSubmitting}>
              Generate Blog
            </Button>
          </form>

          {blog && (
            <div className="mt-10 space-y-6">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Saved Draft
                    </h2>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      ID: {blog._id || 'No MongoDB ID returned'}
                    </p>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Slug: {blog.slug || 'No slug returned'}
                    </p>

                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Status: {blog.status}
                    </p>

                    {!canPersistBlog && (
                      <p className="mt-2 rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400">
                        Backend returned generated content but not a valid MongoDB blog ID.
                        Save and publish are disabled until the API returns data.blog._id.
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={handleSaveBlog}
                      isLoading={isSaving}
                      disabled={!canPersistBlog || isSaving}
                    >
                      Save Changes
                    </Button>

                    <Button
                      type="button"
                      onClick={handlePublishBlog}
                      isLoading={isSaving}
                      disabled={!canPersistBlog || isSaving}
                    >
                      Save & Publish
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <Input
                  value={editableTitle}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setEditableTitle(event.target.value)
                  }
                  type="text"
                  label="Editable Title"
                  placeholder="Blog title"
                  dir="ltr"
                />

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Editable Keywords
                  </label>

                  <textarea
                    value={editableKeywords}
                    onChange={(event) => setEditableKeywords(event.target.value)}
                    rows={3}
                    placeholder="keyword 1, keyword 2"
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Meta Description
                </label>

                <textarea
                  value={editableMetaDescription}
                  onChange={(event) =>
                    setEditableMetaDescription(event.target.value)
                  }
                  rows={3}
                  maxLength={180}
                  placeholder="SEO meta description"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  dir="ltr"
                />

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editableMetaDescription.length}/180 characters
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Excerpt
                </label>

                <textarea
                  value={editableExcerpt}
                  onChange={(event) => setEditableExcerpt(event.target.value)}
                  rows={3}
                  placeholder="Short blog summary"
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none focus:border-gray-400 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  dir="ltr"
                />
              </div>

              <div>
                <div className="mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Blog Editor
                  </h2>

                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Edit the generated content and save it back to the same AiBlog document.
                  </p>
                </div>

                <SmartBlogEditor
                  value={editorHtml}
                  onChange={setEditorHtml}
                  placeholder="Write or edit the blog content..."
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default BlogPage;