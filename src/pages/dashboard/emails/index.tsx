import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

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

const GmailMarketingPage = () => {
  const router = useRouter();

  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [nextPageToken, setNextPageToken] = useState('');
  const [resultSizeEstimate, setResultSizeEstimate] = useState(0);

  const formatDate = (value?: string) => {
    if (!value) return '—';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return parsed.toLocaleString();
  };

  const isUnread = (email: GmailMessage) =>
    Array.isArray(email.labelIds) && email.labelIds.includes('UNREAD');

  const loadEmails = async ({
    append = false,
    pageToken,
    silent = false,
  }: {
    append?: boolean;
    pageToken?: string;
    silent?: boolean;
  } = {}) => {
    try {
      if (!silent && !append) {
        setLoading(true);
      }

      if (append) {
        setLoadingMore(true);
      }

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEmails({ silent: true });
  };

  const handleLoadMore = async () => {
    if (!nextPageToken) return;

    await loadEmails({
      append: true,
      pageToken: nextPageToken,
      silent: true,
    });
  };

  const handleOpenEmail = (emailId: string) => {
    router.push(`/dashboard/emails/${emailId}`);
  };

  useEffect(() => {
    loadEmails();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-6" dir="ltr">
        <div className="flex flex-col gap-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Marketing Emails
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Emails filtered by Gmail label: Marketing
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {resultSizeEstimate || emails.length} emails
              </p>
            </div>

            <Button onClick={handleRefresh} disabled={loading || refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Loading marketing emails...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        ) : emails.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No emails found for label <span className="font-semibold">Marketing</span>.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {emails.map((email) => (
                <button
                  key={email.id}
                  type="button"
                  onClick={() => handleOpenEmail(email.id)}
                  className={`block w-full rounded-xl border bg-white p-5 text-left shadow-sm transition cursor-pointer hover:border-blue-300 hover:shadow-md dark:bg-gray-900 ${
                    isUnread(email)
                      ? 'border-blue-200 dark:border-blue-900'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        {isUnread(email) ? (
                          <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                            Unread
                          </span>
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
                    </div>

                    <div className="shrink-0 text-sm text-gray-500 dark:text-gray-400 md:pl-6">
                      {formatDate(email.date)}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {nextPageToken ? (
              <div className="flex justify-center pt-2">
                <Button onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading more...' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default GmailMarketingPage;