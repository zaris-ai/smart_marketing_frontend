import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { saveAs } from 'file-saver';
import { useEffect, useMemo, useState } from 'react';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { withAuth } from '@/utils';

type RunStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';

type ShopifyTrendsDoc = {
  _id: string;
  title: string;
  topic: string;
  targetAppName: string;
  targetAppUrl: string;
  crewName: string;
  html: string;
  status: 'success' | 'failed';
  generatedAt: string;
  createdAt: string;
  updatedAt: string;
  telegram?: {
    published?: boolean;
    channelId?: string;
    messageIds?: number[];
    publishedAt?: string | null;
    error?: string;
  };
};

type BackgroundRun = {
  _id: string;
  crewName: string;
  title?: string;
  status: RunStatus;
  result?: any;
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

function slugify(value: string) {
  return (value || 'shopify-trends-report')
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

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString();
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

  const pushRunsParagraph = (
    runs: TextRun[],
    spacing: { before?: number; after?: number } = { after: 120 }
  ) => {
    if (!runs.length) return;

    paragraphs.push(
      new Paragraph({
        children: runs,
        spacing,
      })
    );
  };

  const inlineRunsFromNode = (
    node: ChildNode,
    styles: { bold?: boolean; italics?: boolean } = {}
  ): TextRun[] => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ') || '';
      if (!text.trim()) return [];

      return [
        new TextRun({
          text,
          bold: styles.bold,
          italics: styles.italics,
        }),
      ];
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return [];

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      return [new TextRun({ text: '\n' })];
    }

    if (tag === 'strong' || tag === 'b') {
      return Array.from(el.childNodes).flatMap((child) =>
        inlineRunsFromNode(child, { ...styles, bold: true })
      );
    }

    if (tag === 'em' || tag === 'i') {
      return Array.from(el.childNodes).flatMap((child) =>
        inlineRunsFromNode(child, { ...styles, italics: true })
      );
    }

    if (tag === 'a') {
      const text = cleanText(el.textContent);
      const href = cleanText(el.getAttribute('href'));
      const value = href ? `${text || href} (${href})` : text;

      if (!value) return [];

      return [
        new TextRun({
          text: value,
          bold: styles.bold,
          italics: styles.italics,
          underline: {},
        }),
      ];
    }

    return Array.from(el.childNodes).flatMap((child) =>
      inlineRunsFromNode(child, styles)
    );
  };

  const parseTable = (table: HTMLTableElement) => {
    const rows = Array.from(table.querySelectorAll('tr'));

    rows.forEach((row, rowIndex) => {
      const cells = Array.from(row.querySelectorAll('th, td'))
        .map((cell) => cleanText(cell.textContent))
        .filter(Boolean);

      if (!cells.length) return;

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: cells.join(' | '),
              bold: rowIndex === 0,
            }),
          ],
          spacing: { after: 80 },
        })
      );
    });

    paragraphs.push(new Paragraph({ text: '' }));
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

    if (tag === 'h4' || tag === 'h5' || tag === 'h6') {
      pushTextParagraph(element.textContent || '', {
        bold: true,
        size: 22,
        spacing: { before: 200, after: 100 },
      });
      return;
    }

    if (tag === 'p') {
      const runs = Array.from(element.childNodes).flatMap((child) =>
        inlineRunsFromNode(child)
      );
      pushRunsParagraph(runs, { after: 120 });
      return;
    }

    if (tag === 'li') {
      const runs = Array.from(element.childNodes).flatMap((child) =>
        inlineRunsFromNode(child)
      );
      pushRunsParagraph([new TextRun({ text: '• ', bold: true }), ...runs], {
        after: 80,
      });
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      Array.from(element.children).forEach((child) => walk(child));
      return;
    }

    if (tag === 'table') {
      parseTable(element as HTMLTableElement);
      return;
    }

    if (
      ['div', 'section', 'article', 'main', 'header', 'footer', 'aside'].includes(
        tag
      )
    ) {
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

const TrendsPage = () => {
  const [serverError, setServerError] = useState('');
  const [html, setHtml] = useState('');
  const [latestDoc, setLatestDoc] = useState<ShopifyTrendsDoc | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState<RunStatus | ''>('');
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);

  const hasResult = useMemo(() => html.trim().length > 0, [html]);

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';
    if (runStatus === 'cancelled') return 'Cancelled';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

  const fetchLatest = async () => {
    try {
      setIsLoadingLatest(true);
      setServerError('');

      const response = await api.get('/shopify-trends/latest');
      const doc = response?.data?.data || null;

      setLatestDoc(doc);

      if (doc?.html) {
        setHtml(doc.html);
      } else {
        setHtml('');
      }
    } catch (error: any) {
      console.log(error);
      setServerError(
        getErrorMessage(error, 'Failed to fetch latest Shopify trends report.')
      );
    } finally {
      setIsLoadingLatest(false);
    }
  };

  useEffect(() => {
    fetchLatest();
  }, []);

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${runId}`);
        const run: BackgroundRun | undefined = response?.data?.data;

        if (!run) return;

        setRunStatus(run.status);

        if (run.status === 'success') {
          clearInterval(timer);
          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          await fetchLatest();

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);
          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          setServerError(
            run?.error?.message || 'Shopify trends background task failed.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'cancelled') {
          clearInterval(timer);
          setIsBackgroundRunning(false);
          setIsSubmitting(false);

          setServerError(
            run?.error?.message || 'Shopify trends task was cancelled.'
          );

          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);
        setIsBackgroundRunning(false);
        setIsSubmitting(false);

        setServerError(
          getErrorMessage(
            error,
            'Shopify trends completed, but the result could not be loaded.'
          )
        );

        setRunId('');
        setRunStatus('');
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [runId]);

  const onRunCrew = async () => {
    try {
      setIsSubmitting(true);
      setIsBackgroundRunning(false);
      setServerError('');
      setRunId('');
      setRunStatus('');

      const response = await api.post('/shopify-trends/run', {
        title: 'Shopify Trends Report',
        topic: 'Shopify analytics trends for ecommerce apps',
        target_app_name: 'Arka: Smart Analyzer',
        target_app_url: 'https://apps.shopify.com/arka-smart-analyzer',
        target_market: 'Shopify app founders and merchants',
        tone: 'direct and strategic',
        publish_goal: 'internal executive report',
        keywords: [
          'shopify analytics',
          'shopify dashboard',
          'shopify traffic',
          'shopify trends',
        ],
        app_urls: [],
        store_urls: [],
      });

      const responseData = response?.data?.data;
      const nextRunId = responseData?.runId;
      const nextStatus = responseData?.status || 'queued';

      if (nextRunId) {
        setRunId(nextRunId);
        setRunStatus(nextStatus);
        setIsBackgroundRunning(true);
        return;
      }

      // Backward compatibility if backend still returns completed doc.
      const doc = responseData || null;

      setLatestDoc(doc);

      if (doc?.html) {
        setHtml(doc.html);
      } else {
        setHtml('');
      }
    } catch (error: any) {
      console.log(error);
      setServerError(getErrorMessage(error, 'Failed to start Shopify trends crew.'));
    } finally {
      setIsSubmitting(false);
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
      setServerError('Shopify trends task was cancelled.');

      setRunId('');
    } catch (error: any) {
      setServerError(getErrorMessage(error, 'Failed to stop Shopify trends task.'));
    }
  };

  const downloadDOCX = async () => {
    if (!html.trim()) return;

    const title = latestDoc?.title || 'Shopify Trends Report';

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

            ...(latestDoc?.topic
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Topic: ${latestDoc.topic}`,
                        italics: true,
                      }),
                    ],
                    spacing: { after: 120 },
                  }),
                ]
              : []),

            ...(latestDoc?.crewName
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Crew: ${latestDoc.crewName}`,
                        italics: true,
                      }),
                    ],
                    spacing: { after: 180 },
                  }),
                ]
              : []),

            ...htmlToDocxParagraphs(html),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${slugify(title)}.docx`);
  };

  const isBusy = isSubmitting || isBackgroundRunning;

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Shopify Trends Report
                </h1>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  View the latest saved report first, then generate and save a
                  new one in the background.
                </p>

                {latestDoc?.generatedAt && (
                  <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                    Latest generated: {formatDate(latestDoc.generatedAt)}
                  </p>
                )}

                {latestDoc?.telegram && (
                  <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    Telegram:{' '}
                    {latestDoc.telegram.published
                      ? `Published${
                          latestDoc.telegram.publishedAt
                            ? ` at ${formatDate(latestDoc.telegram.publishedAt)}`
                            : ''
                        }`
                      : latestDoc.telegram.error
                        ? `Failed: ${latestDoc.telegram.error}`
                        : 'Not published'}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                {isBackgroundRunning && (
                  <Button type="button" onClick={onCancelRun}>
                    Stop Task
                  </Button>
                )}

                <Button
                  type="button"
                  onClick={onRunCrew}
                  isLoading={isBusy}
                  disabled={isBusy}
                >
                  {isBackgroundRunning
                    ? 'Running in Background...'
                    : 'Run New Trends Report'}
                </Button>

                <Button
                  type="button"
                  onClick={downloadDOCX}
                  disabled={!hasResult || isBusy || isLoadingLatest}
                >
                  Download Word
                </Button>
              </div>
            </div>

            {isBackgroundRunning && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />
                  <span>
                    Shopify trends report is running in background. Status:{' '}
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

            {serverError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {serverError}
              </div>
            )}
          </div>

          {isLoadingLatest && (
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="animate-pulse space-y-4">
                <div className="h-8 w-64 rounded bg-gray-200 dark:bg-gray-800" />
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                  <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-800" />
                </div>
                <div className="h-64 rounded-2xl bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          )}

          {!isLoadingLatest && hasResult && (
            <div
              className="rounded-xl bg-white p-4 shadow-sm dark:bg-gray-900"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}

          {!isLoadingLatest && !hasResult && (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-900">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                No saved trends report yet
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Run the crew once and the latest generated report will be stored
                in MongoDB.
              </p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default TrendsPage;