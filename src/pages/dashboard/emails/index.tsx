import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';

type GmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  from: string;
  to: string;
  cc?: string;
  subject: string;
  date: string;
  internalDate: string;
};

type SavedEmail = {
  _id: string;
  gmailId: string;
  subject: string;
  from: string;
  to: string;
  snippet: string;
  date: string;
  status: 'read' | 'unread';
  answerStatus: 'answered' | 'not_answered';
  localTags: string[];
  latestAnalysis?: any;
  createdAt: string;
  updatedAt: string;
};

type ViewMode = 'gmail' | 'saved';
type SortOrder = 'asc' | 'desc';

const GmailMarketingPage = () => {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>('saved');

  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [savedEmails, setSavedEmails] = useState<SavedEmail[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState('');
  const [resultSizeEstimate, setResultSizeEstimate] = useState(0);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [answerStatus, setAnswerStatus] = useState('');
  const [tag, setTag] = useState('');
  const [hasAnalysis, setHasAnalysis] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const formatDate = (value?: string) => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  const isUnread = (email: GmailMessage) =>
    Array.isArray(email.labelIds) && email.labelIds.includes('UNREAD');

  const savedByGmailId = useMemo(() => {
    const map = new Map<string, SavedEmail>();
    savedEmails.forEach((item) => map.set(item.gmailId, item));
    return map;
  }, [savedEmails]);

  const loadGmailEmails = async ({
    append = false,
    pageToken,
    silent = false,
  }: {
    append?: boolean;
    pageToken?: string;
    silent?: boolean;
  } = {}) => {
    try {
      if (!silent && !append) setLoading(true);
      if (append) setLoadingMore(true);
      setError('');

      const response = await api.get('/gmail/messages', {
        params: {
          maxResults: 10,
          labelName: 'Marketing',
          ...(pageToken ? { pageToken } : {}),
        },
      });

      const data = response?.data?.data;
      const fetchedEmails: GmailMessage[] = data?.messages || [];

      setEmails((prev) => (append ? [...prev, ...fetchedEmails] : fetchedEmails));
      setNextPageToken(data?.nextPageToken || '');
      setResultSizeEstimate(data?.resultSizeEstimate || 0);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load marketing emails'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  const loadSavedEmails = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError('');

      const response = await api.get('/gmail/saved', {
        params: {
          page: 1,
          limit: 100,
          ...(q ? { q } : {}),
          ...(status ? { status } : {}),
          ...(answerStatus ? { answerStatus } : {}),
          ...(tag ? { tag } : {}),
          ...(hasAnalysis ? { hasAnalysis } : {}),
          sortBy,
          sortOrder,
        },
      });

      setSavedEmails(response?.data?.data?.items || []);
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load saved emails'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadInitial = async () => {
    if (viewMode === 'gmail') {
      await Promise.all([loadGmailEmails(), loadSavedEmails({ silent: true })]);
    } else {
      await loadSavedEmails();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    if (viewMode === 'gmail') {
      await Promise.all([
        loadGmailEmails({ silent: true }),
        loadSavedEmails({ silent: true }),
      ]);
    } else {
      await loadSavedEmails({ silent: true });
    }
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;

    await loadGmailEmails({
      append: true,
      pageToken: nextPageToken,
      silent: true,
    });
  };

  const handleOpenGmailEmail = (emailId: string) => {
    router.push(`/dashboard/emails/${emailId}`);
  };

  const handleOpenSavedEmail = (savedId: string) => {
    router.push(`/dashboard/emails/${savedId}?source=saved`);
  };

  const handleSaveEmail = async (emailId: string) => {
    try {
      setSavingId(emailId);
      setError('');

      await api.post(`/gmail/messages/${emailId}/save`);
      await loadSavedEmails({ silent: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to save email'
      );
    } finally {
      setSavingId('');
    }
  };

  const handleUpdateSavedStatus = async (
    saved: SavedEmail,
    patch: Partial<Pick<SavedEmail, 'status' | 'answerStatus' | 'localTags'>>
  ) => {
    try {
      setError('');

      await api.patch(`/gmail/saved/${saved._id}`, patch);
      await loadSavedEmails({ silent: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to update saved email'
      );
    }
  };

  const handleDeleteSaved = async (savedId: string) => {
    try {
      setDeletingId(savedId);
      setError('');

      await api.delete(`/gmail/saved/${savedId}`);
      await loadSavedEmails({ silent: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to delete saved email'
      );
    } finally {
      setDeletingId('');
    }
  };

  const handleApplyFilters = async () => {
    setViewMode('saved');
    await loadSavedEmails({ silent: true });
  };

  const handleResetFilters = () => {
    setQ('');
    setStatus('');
    setAnswerStatus('');
    setTag('');
    setHasAnalysis('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setViewMode('saved');
  };

  useEffect(() => {
    loadInitial();
  }, [viewMode]);

  useEffect(() => {
    if (viewMode !== 'saved') return;

    const timer = setTimeout(() => {
      loadSavedEmails({ silent: true });
    }, 400);

    return () => clearTimeout(timer);
  }, [q, status, answerStatus, tag, hasAnalysis, sortBy, sortOrder, viewMode]);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Marketing Emails
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gmail messages and locally saved email workflow records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setViewMode('gmail')} disabled={viewMode === 'gmail'}>
              Gmail
            </Button>

            <Button onClick={() => setViewMode('saved')} disabled={viewMode === 'saved'}>
              Saved DB
            </Button>

            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {viewMode === 'gmail'
                  ? resultSizeEstimate || emails.length
                  : savedEmails.length}{' '}
                emails
              </p>
            </div>

            <Button onClick={handleRefresh} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Filters & Sorting
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              These filters and sorting options apply to Saved DB emails.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject, sender, body, tag..."
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All read status</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>

            <select
              value={answerStatus}
              onChange={(e) => setAnswerStatus(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All answer status</option>
              <option value="not_answered">Not answered</option>
              <option value="answered">Answered</option>
            </select>

            <select
              value={hasAnalysis}
              onChange={(e) => setHasAnalysis(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="">All analysis status</option>
              <option value="true">Analyzed</option>
              <option value="false">Not analyzed</option>
            </select>

            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Filter by tag"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
            >
              <option value="createdAt">Created date</option>
              <option value="updatedAt">Updated date</option>
              <option value="date">Email date</option>
              <option value="subject">Subject</option>
              <option value="from">Sender</option>
              <option value="status">Read status</option>
              <option value="answerStatus">Answer status</option>
            </select>

            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
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
              Loading emails...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : viewMode === 'gmail' ? (
          emails.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No Gmail emails found for label <span className="font-semibold">Marketing</span>.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {emails.map((email) => {
                  const saved = savedByGmailId.get(email.id);

                  return (
                    <div
                      key={email.id}
                      className={`rounded-xl border bg-white p-5 shadow-sm transition dark:bg-gray-900 ${
                        isUnread(email)
                          ? 'border-blue-200 dark:border-blue-900'
                          : 'border-gray-200 dark:border-gray-800'
                      }`}
                    >
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <button
                          type="button"
                          onClick={() => handleOpenGmailEmail(email.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            {isUnread(email) ? (
                              <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                                Gmail Unread
                              </span>
                            ) : null}

                            {saved ? (
                              <>
                                <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                                  Saved
                                </span>

                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  {saved.status}
                                </span>

                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  {saved.answerStatus.replace('_', ' ')}
                                </span>

                                {saved.latestAnalysis ? (
                                  <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                                    Analyzed
                                  </span>
                                ) : null}
                              </>
                            ) : null}

                            {(email.labelIds || []).slice(0, 4).map((label) => (
                              <span
                                key={label}
                                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {label.replaceAll('_', ' ')}
                              </span>
                            ))}
                          </div>

                          <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                            {email.subject || '(No subject)'}
                          </h2>

                          <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <p>
                              <span className="font-medium text-gray-900 dark:text-white">
                                From:
                              </span>{' '}
                              {email.from || '—'}
                            </p>

                            <p>
                              <span className="font-medium text-gray-900 dark:text-white">
                                To:
                              </span>{' '}
                              {email.to || '—'}
                            </p>
                          </div>

                          <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                            {email.snippet || '—'}
                          </p>
                        </button>

                        <div className="flex shrink-0 flex-col items-start gap-3 text-sm text-gray-500 dark:text-gray-400 md:items-end md:pl-6">
                          <span>{formatDate(email.date)}</span>

                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => handleOpenGmailEmail(email.id)}>
                              Open
                            </Button>

                            {saved ? (
                              <Button onClick={() => handleOpenSavedEmail(saved._id)}>
                                DB Details
                              </Button>
                            ) : (
                              <Button
                                onClick={() => handleSaveEmail(email.id)}
                                disabled={savingId === email.id}
                              >
                                {savingId === email.id ? 'Saving...' : 'Save'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {nextPageToken ? (
                <div className="flex justify-center pt-2">
                  <Button onClick={handleLoadMore} disabled={loadingMore}>
                    {loadingMore ? 'Loading more...' : 'Load more'}
                  </Button>
                </div>
              ) : null}
            </>
          )
        ) : savedEmails.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No saved emails found.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {savedEmails.map((email) => (
              <div
                key={email._id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <button
                    type="button"
                    onClick={() => handleOpenSavedEmail(email._id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                        Saved
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {email.status}
                      </span>

                      <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {email.answerStatus.replace('_', ' ')}
                      </span>

                      {email.latestAnalysis ? (
                        <span className="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 dark:bg-purple-950/40 dark:text-purple-300">
                          Analyzed
                        </span>
                      ) : null}

                      {(email.localTags || []).map((item) => (
                        <span
                          key={item}
                          className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>

                    <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                      {email.subject || '(No subject)'}
                    </h2>

                    <div className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
                      <p>
                        <span className="font-medium text-gray-900 dark:text-white">
                          From:
                        </span>{' '}
                        {email.from || '—'}
                      </p>

                      <p>
                        <span className="font-medium text-gray-900 dark:text-white">
                          To:
                        </span>{' '}
                        {email.to || '—'}
                      </p>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-600 dark:text-gray-400">
                      {email.snippet || '—'}
                    </p>
                  </button>

                  <div className="flex shrink-0 flex-col items-start gap-3 text-sm text-gray-500 dark:text-gray-400 md:items-end md:pl-6">
                    <span>{formatDate(email.date)}</span>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() =>
                          handleUpdateSavedStatus(email, {
                            status: email.status === 'read' ? 'unread' : 'read',
                          })
                        }
                      >
                        Mark {email.status === 'read' ? 'Unread' : 'Read'}
                      </Button>

                      <Button
                        onClick={() =>
                          handleUpdateSavedStatus(email, {
                            answerStatus:
                              email.answerStatus === 'answered'
                                ? 'not_answered'
                                : 'answered',
                          })
                        }
                      >
                        Mark {email.answerStatus === 'answered' ? 'Not Answered' : 'Answered'}
                      </Button>

                      <Button onClick={() => handleOpenSavedEmail(email._id)}>
                        Details
                      </Button>

                      <Button
                        onClick={() => handleDeleteSaved(email._id)}
                        disabled={deletingId === email._id}
                      >
                        {deletingId === email._id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default GmailMarketingPage;