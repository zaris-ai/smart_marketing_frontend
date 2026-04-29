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
  app_name?: string;
  source_urls?: string[];
  customer_email?: {
    from?: string;
    name?: string;
    subject?: string;
    body?: string;
  };
  analysis?: {
    primary_intent?: string;
    secondary_intent?: string;
    sentiment?: string;
    stage?: string;
    urgency?: string;
    explicit_questions?: string[];
    inferred_concerns?: string[];
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

const GmailEmailDetailPage = () => {
  const router = useRouter();

  const emailId = useMemo(() => {
    if (!router.query.id) return '';
    return Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
  }, [router.query.id]);

  const [email, setEmail] = useState<GmailFullMessage | null>(null);
  const [thread, setThread] = useState<GmailThread | null>(null);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState('');

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<CrewAnalysisResponse | null>(null);
  const [copyState, setCopyState] = useState<'subject' | 'body' | ''>('');

  const formatDate = (value?: string) => {
    if (!value) return '—';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString();
  };

  const getReadableBody = (message?: GmailFullMessage | null) => {
    if (!message) return '';
    return (
      message.textPlain?.trim() ||
      message.snippet?.trim() ||
      'No readable plain-text body found.'
    );
  };

  const extractEmailAddress = (value?: string) => {
    if (!value) return '';
    const match = value.match(/<([^>]+)>/);
    if (match?.[1]) return match[1].trim();
    return value.trim();
  };

  const extractNameFromFromField = (value?: string) => {
    if (!value) return '';

    const angleMatch = value.match(/^(.*?)\s*<[^>]+>$/);
    if (angleMatch?.[1]) {
      return angleMatch[1].replace(/^"|"$/g, '').trim();
    }

    const emailOnly = extractEmailAddress(value);
    if (emailOnly.includes('@')) {
      return '';
    }

    return value.trim();
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

  const loadEmail = async () => {
    if (!emailId) return;

    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/gmail/messages/${emailId}`);
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

  const handleAnalyze = async () => {
    if (!email) return;

    try {
      setAnalyzing(true);
      setAnalysisError('');
      setAnalysisResult(null);

      const response = await api.post(`/gmail/messages/${email.id}/analyze`, {
        desired_tone: 'professional, direct, helpful',
        sender_name: 'Mahdi',
        sender_role: 'Founder',
        sender_company: 'Arka',
        cta_goal: 'move the conversation toward a short discovery call',
      });

      setAnalysisResult(response?.data?.data || null);
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

  useEffect(() => {
    if (!router.isReady || !emailId) return;
    loadEmail();
  }, [router.isReady, emailId]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Email Details
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Full email content, conversation history, and AI analysis
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => router.push('/dashboard/emails/marketing')}>
              Back to marketing emails
            </Button>

            <Button onClick={loadEmail} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>

            <Button onClick={handleAnalyze} disabled={loading || analyzing || !email}>
              {analyzing ? 'Analyzing...' : 'Analyze'}
            </Button>
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
        ) : !email ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Email not found.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {(email.labelIds || []).map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {label.replaceAll('_', ' ')}
                  </span>
                ))}
              </div>

              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                {email.subject || '(No subject)'}
              </h2>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    From
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{email.from || '—'}</p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Date
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">
                    {formatDate(email.date)}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    To
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{email.to || '—'}</p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    CC
                  </p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{email.cc || '—'}</p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800 md:col-span-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Thread ID
                  </p>
                  <p className="mt-1 break-all text-sm text-gray-900 dark:text-white">
                    {email.threadId || '—'}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-800 dark:bg-gray-950/40">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Email Body
                </p>
                <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-gray-700 dark:text-gray-300">
                  {getReadableBody(email)}
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
                    Full conversation thread
                  </p>
                </div>

                {threadLoading ? (
                  <span className="text-sm text-gray-500 dark:text-gray-400">Loading thread...</span>
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
                      key={message.id}
                      className={`rounded-xl border p-5 ${
                        message.id === email.id
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
                            {message.id === email.id ? ' • Current email' : ''}
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
                        <p>
                          <span className="font-medium text-gray-900 dark:text-white">CC:</span>{' '}
                          {message.cc || '—'}
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
                    AI Analysis & Reply Draft
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Run the marketing email crew and review the generated answer here
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
                    No analysis yet. Click <span className="font-semibold">Analyze</span> to run the crew for this email.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Primary Intent
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {analysisResult.analysis?.primary_intent || '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Sentiment
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {analysisResult.analysis?.sentiment || '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Stage
                      </p>
                      <p className="mt-1 text-sm text-gray-900 dark:text-white">
                        {analysisResult.analysis?.stage || '—'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Human Review
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                        {analysisResult.analysis?.needs_human_review ? 'Required' : 'Not required'}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Explicit Questions
                      </p>
                      {analysisResult.analysis?.explicit_questions?.length ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.analysis.explicit_questions.map((item, index) => (
                            <li key={`${item}-${index}`} className="ml-5 list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No explicit questions detected.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Inferred Concerns
                      </p>
                      {analysisResult.analysis?.inferred_concerns?.length ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.analysis.inferred_concerns.map((item, index) => (
                            <li key={`${item}-${index}`} className="ml-5 list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No major inferred concerns.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Safe Product Facts
                      </p>
                      {analysisResult.analysis?.safe_product_facts?.length ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.analysis.safe_product_facts.map((item, index) => (
                            <li key={`${item}-${index}`} className="ml-5 list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No safe facts returned.</p>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
                      <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-white">
                        Claims To Avoid
                      </p>
                      {analysisResult.analysis?.claims_to_avoid?.length ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.analysis.claims_to_avoid.map((item, index) => (
                            <li key={`${item}-${index}`} className="ml-5 list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No avoid-list returned.</p>
                      )}
                    </div>
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

                    <div className="mt-4">
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Key Points
                      </p>
                      {analysisResult.reply_strategy?.key_points?.length ? (
                        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                          {analysisResult.reply_strategy.key_points.map((item, index) => (
                            <li key={`${item}-${index}`} className="ml-5 list-disc">
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-gray-400">No key points returned.</p>
                      )}
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
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default GmailEmailDetailPage;