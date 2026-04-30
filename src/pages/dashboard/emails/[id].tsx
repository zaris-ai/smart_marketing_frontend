import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type GmailFullMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId?: string | null;
  internalDate: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: string;
  textPlain?: string;
  textHtml?: string;
  headers?: { name: string; value: string }[];
};

type GmailThread = {
  id: string;
  historyId?: string | null;
  messages: GmailFullMessage[];
};

type CrewAnalysisResponse = {
  source_type?: string;
  app_name?: string;
  source_urls?: string[];
  contact?: {
    label?: string;
    full_name?: string;
    email?: string;
    shopify_store?: string;
    topic?: string;
    message?: string;
    source?: string;
  };
  analysis?: {
    primary_intent?: string;
    sentiment?: string;
    urgency?: string;
    is_actionable?: boolean;
    missing_information?: string[];
    recommended_response_goal?: string;
    safe_product_facts?: string[];
    claims_to_avoid?: string[];
    needs_human_review?: boolean;
  };
  reply_strategy?: {
    tone?: string;
    cta?: string;
    key_points?: string[];
  };
  reply?: {
    subject?: string;
    body_text?: string;
    body_html?: string;
  };
};

type SavedEmail = {
  _id: string;
  gmailId: string;
  threadId: string;
  labelIds: string[];
  localTags: string[];
  status: 'read' | 'unread';
  answerStatus: 'answered' | 'not_answered';
  snippet: string;
  from: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  date: string;
  textPlain?: string;
  textHtml?: string;
  threadMessages?: GmailFullMessage[];
  latestAnalysis?: CrewAnalysisResponse | null;
  analysisHistory?: {
    analyzedAt: string;
    crewName: string;
    payload: any;
    result: CrewAnalysisResponse;
  }[];
};

const GmailEmailDetailPage = () => {
  const router = useRouter();

  const id = useMemo(() => {
    if (!router.query.id) return '';
    return Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  }, [router.query.id]);

  const source = useMemo(() => {
    if (!router.query.source) return 'gmail';
    return Array.isArray(router.query.source) ? router.query.source[0] : router.query.source;
  }, [router.query.source]);

  const isSavedMode = source === 'saved';

  const [email, setEmail] = useState<GmailFullMessage | null>(null);
  const [savedEmail, setSavedEmail] = useState<SavedEmail | null>(null);
  const [thread, setThread] = useState<GmailThread | null>(null);

  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');

  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<CrewAnalysisResponse | null>(null);
  const [copyState, setCopyState] = useState<'subject' | 'body' | ''>('');
  const [tagInput, setTagInput] = useState('');

  const displayEmail = savedEmail || email;

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const getReadableBody = (message?: GmailFullMessage | SavedEmail | null) => {
    if (!message) return '';
    return (
      message.textPlain?.trim() ||
      message.snippet?.trim() ||
      'No readable plain-text body found.'
    );
  };

  const copyToClipboard = async (text: string, type: 'subject' | 'body') => {
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyState(type);
      setTimeout(() => setCopyState(''), 1500);
    } catch {
      setCopyState('');
    }
  };

  const loadSavedEmail = async (savedId: string) => {
    const response = await api.get(`/gmail/saved/${savedId}`);
    const data: SavedEmail | null = response?.data?.data || null;

    setSavedEmail(data);
    setAnalysisResult(data?.latestAnalysis || null);

    if (data?.threadMessages?.length) {
      const sortedMessages = [...data.threadMessages].sort(
        (a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0)
      );

      setThread({
        id: data.threadId || '',
        messages: sortedMessages,
      });
    } else {
      setThread(null);
    }
  };

  const loadGmailEmail = async (gmailId: string) => {
    const response = await api.get(`/gmail/messages/${gmailId}`);
    const data: GmailFullMessage | null = response?.data?.data || null;

    setEmail(data);

    if (data?.threadId) {
      setThreadLoading(true);

      const threadResponse = await api.get(`/gmail/threads/${data.threadId}`);
      const threadData: GmailThread | null = threadResponse?.data?.data || null;

      const sortedMessages = [...(threadData?.messages || [])].sort(
        (a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0)
      );

      setThread(
        threadData
          ? {
              ...threadData,
              messages: sortedMessages,
            }
          : null
      );
    } else {
      setThread(null);
    }
  };

  const loadEmail = async () => {
    if (!id) return;

    try {
      setLoading(true);
      setError('');
      setAnalysisError('');

      if (isSavedMode) {
        await loadSavedEmail(id);
      } else {
        setAnalysisResult(null);
        await loadGmailEmail(id);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load email details'
      );
    } finally {
      setLoading(false);
      setThreadLoading(false);
    }
  };

  const handleSave = async () => {
    if (!email?.id) return;

    try {
      setSaving(true);
      setError('');

      const response = await api.post(`/gmail/messages/${email.id}/save`);
      const saved: SavedEmail | null = response?.data?.data || null;

      if (saved?._id) {
        router.replace(`/dashboard/emails/${saved._id}?source=saved`);
      }
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save email'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    const gmailId = isSavedMode ? savedEmail?.gmailId : email?.id;
    if (!gmailId) return;

    try {
      setAnalyzing(true);
      setAnalysisError('');
      setAnalysisResult(null);

      const response = await api.post(`/gmail/messages/${gmailId}/analyze`, {
        desired_tone: 'professional, direct, helpful',
        sender_name: 'Mahdi',
        sender_role: 'Founder',
        sender_company: 'Arka',
        cta_goal: 'reply clearly and move the conversation to the next useful step',
      });

      setAnalysisResult(response?.data?.data || null);

      if (isSavedMode) {
        await loadSavedEmail(id);
      } else if (response?.data?.savedEmail?._id) {
        setSavedEmail(response.data.savedEmail);
      }
    } catch (err: any) {
      setAnalysisError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to analyze email'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdateSaved = async (
    patch: Partial<Pick<SavedEmail, 'status' | 'answerStatus' | 'localTags'>>
  ) => {
    if (!savedEmail?._id) return;

    try {
      setUpdating(true);
      setError('');

      const response = await api.patch(`/gmail/saved/${savedEmail._id}`, patch);
      setSavedEmail(response?.data?.data || null);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update saved email'
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleAddTag = async () => {
    const cleanTag = tagInput.trim();
    if (!cleanTag || !savedEmail) return;

    const nextTags = Array.from(new Set([...(savedEmail.localTags || []), cleanTag]));
    setTagInput('');
    await handleUpdateSaved({ localTags: nextTags });
  };

  const handleRemoveTag = async (tag: string) => {
    if (!savedEmail) return;

    const nextTags = (savedEmail.localTags || []).filter((item) => item !== tag);
    await handleUpdateSaved({ localTags: nextTags });
  };

  const handleDeleteSaved = async () => {
    if (!savedEmail?._id) return;

    try {
      setDeleting(true);
      await api.delete(`/gmail/saved/${savedEmail._id}`);
      router.push('/dashboard/emails/marketing');
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to delete saved email'
      );
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!router.isReady || !id) return;
    loadEmail();
  }, [router.isReady, id, isSavedMode]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Contact Form Email Details
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Save, tag, analyze, and manage local email workflow status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={loadEmail} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>

            {!isSavedMode && email ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save to DB'}
              </Button>
            ) : null}

            <Button onClick={handleAnalyze} disabled={loading || analyzing || !displayEmail}>
              {analyzing ? 'Analyzing...' : 'Analyze Body'}
            </Button>

            {savedEmail ? (
              <Button onClick={handleDeleteSaved} disabled={deleting}>
                {deleting ? 'Deleting...' : 'Delete Saved'}
              </Button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading email details...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : !displayEmail ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Email not found.</p>
          </div>
        ) : (
          <>
            {savedEmail ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Local Workflow Status
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      These statuses are saved in your database, not Gmail.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        handleUpdateSaved({
                          status: savedEmail.status === 'read' ? 'unread' : 'read',
                        })
                      }
                      disabled={updating}
                    >
                      Mark {savedEmail.status === 'read' ? 'Unread' : 'Read'}
                    </Button>

                    <Button
                      onClick={() =>
                        handleUpdateSaved({
                          answerStatus:
                            savedEmail.answerStatus === 'answered'
                              ? 'not_answered'
                              : 'answered',
                        })
                      }
                      disabled={updating}
                    >
                      Mark{' '}
                      {savedEmail.answerStatus === 'answered'
                        ? 'Not Answered'
                        : 'Answered'}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Read Status
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {savedEmail.status}
                    </p>
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Answer Status
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      {savedEmail.answerStatus.replace('_', ' ')}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Tags
                  </p>

                  <div className="mb-3 flex flex-wrap gap-2">
                    {(savedEmail.localTags || []).map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                      >
                        {tag} ×
                      </button>
                    ))}

                    {!savedEmail.localTags?.length ? (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        No tags yet.
                      </span>
                    ) : null}
                  </div>

                  <div className="flex max-w-md gap-2">
                    <input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      placeholder="Add tag, e.g. important"
                      className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                    />

                    <Button onClick={handleAddTag} disabled={updating || !tagInput.trim()}>
                      Add Tag
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {savedEmail ? (
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                    Saved DB
                  </span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    Gmail Only
                  </span>
                )}

                {(displayEmail.labelIds || []).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {label.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {displayEmail.subject || '(No subject)'}
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    From
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">
                    {displayEmail.from || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(displayEmail.date)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    To
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">
                    {displayEmail.to || '—'}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    CC
                  </p>
                  <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">
                    {displayEmail.cc || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/40">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Email Body Used For Analysis
                </p>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700 dark:text-gray-300">
                  {getReadableBody(displayEmail)}
                </pre>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Email History
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Saved emails keep this history in MongoDB.
                  </p>
                </div>

                {threadLoading ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Loading thread...
                  </span>
                ) : (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {thread?.messages?.length || 0} messages
                  </span>
                )}
              </div>

              {!thread || !thread.messages?.length ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No thread history found.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {thread.messages.map((message, index) => (
                    <div
                      key={message.id || `${index}`}
                      className={`rounded-xl border p-5 ${
                        message.id === (email?.id || savedEmail?.gmailId)
                          ? 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20'
                          : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50'
                      }`}
                    >
                      <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {message.subject || '(No subject)'}
                          </p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Message {index + 1}
                            {message.id === (email?.id || savedEmail?.gmailId)
                              ? ' • Current email'
                              : ''}
                          </p>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(message.date)}
                        </p>
                      </div>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                        <p>
                          <span className="font-medium text-gray-900 dark:text-white">From:</span>{' '}
                          {message.from || '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-900 dark:text-white">To:</span>{' '}
                          {message.to || '—'}
                        </p>
                      </div>

                      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700 dark:text-gray-300">
                          {getReadableBody(message)}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Contact Form Analysis & Reply Draft
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Analysis is saved to MongoDB after every run.
                  </p>
                </div>
              </div>

              {analysisError ? (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                  {analysisError}
                </div>
              ) : null}

              {!analysisResult ? (
                <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No analysis yet. Click <span className="font-semibold">Analyze Body</span>.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                    <p className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
                      Extracted Contact Details
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      {[
                        ['App Name', analysisResult.app_name],
                        ['Label', analysisResult.contact?.label],
                        ['Full Name', analysisResult.contact?.full_name],
                        ['Email', analysisResult.contact?.email],
                        ['Shopify Store', analysisResult.contact?.shopify_store],
                        ['Topic', analysisResult.contact?.topic],
                        ['Source', analysisResult.contact?.source],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {label}
                          </p>
                          <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">
                            {value || '—'}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Customer Message
                      </p>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700 dark:text-gray-300">
                        {analysisResult.contact?.message || '—'}
                      </pre>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      ['Primary Intent', analysisResult.analysis?.primary_intent],
                      ['Sentiment', analysisResult.analysis?.sentiment],
                      ['Urgency', analysisResult.analysis?.urgency],
                      [
                        'Actionable',
                        analysisResult.analysis?.is_actionable ? 'Yes' : 'No',
                      ],
                      [
                        'Human Review',
                        analysisResult.analysis?.needs_human_review
                          ? 'Required'
                          : 'Not required',
                      ],
                      ['Response Goal', analysisResult.analysis?.recommended_response_goal],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800"
                      >
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          {label}
                        </p>
                        <p className="mt-1 text-sm text-gray-900 dark:text-white">
                          {value || '—'}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <ListBox
                      title="Missing Information"
                      items={analysisResult.analysis?.missing_information}
                    />
                    <ListBox
                      title="Safe Product Facts"
                      items={analysisResult.analysis?.safe_product_facts}
                    />
                    <ListBox
                      title="Claims To Avoid"
                      items={analysisResult.analysis?.claims_to_avoid}
                    />
                    <ListBox
                      title="Reply Key Points"
                      items={analysisResult.reply_strategy?.key_points}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                    <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                      Reply Strategy
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Tone
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.reply_strategy?.tone || '—'}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          CTA
                        </p>
                        <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.reply_strategy?.cta || '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        Generated Reply
                      </p>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() =>
                            copyToClipboard(analysisResult.reply?.subject || '', 'subject')
                          }
                        >
                          {copyState === 'subject' ? 'Subject copied' : 'Copy subject'}
                        </Button>

                        <Button
                          onClick={() =>
                            copyToClipboard(analysisResult.reply?.body_text || '', 'body')
                          }
                        >
                          {copyState === 'body' ? 'Body copied' : 'Copy body'}
                        </Button>
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Subject
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {analysisResult.reply?.subject || '—'}
                      </p>
                    </div>

                    <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Body
                      </p>
                      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700 dark:text-gray-300">
                        {analysisResult.reply?.body_text || '—'}
                      </pre>
                    </div>
                  </div>

                  {savedEmail?.analysisHistory?.length ? (
                    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Analysis History
                      </p>

                      <div className="space-y-2">
                        {savedEmail.analysisHistory.map((item, index) => (
                          <div
                            key={`${item.analyzedAt}-${index}`}
                            className="rounded-xl border border-gray-100 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-800"
                          >
                            <p className="text-sm text-gray-900 dark:text-white">
                              {item.crewName || 'marketing_email_reply'}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDate(item.analyzedAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

const ListBox = ({ title, items }: { title: string; items?: string[] }) => {
  return (
    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
        {title}
      </p>

      {items?.length ? (
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          {items.map((item, index) => (
            <li key={`${item}-${index}`} className="ml-5 list-disc">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No data returned.</p>
      )}
    </div>
  );
};

export const getServerSideProps = withAuth();

export default GmailEmailDetailPage;