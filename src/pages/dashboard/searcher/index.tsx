import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import ReactMarkdown from 'react-markdown';
import { saveAs } from 'file-saver';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { withAuth } from '@/utils';

type ResearchCrewFormData = {
  topic: string;
  audience: string;
  market: string;
  business_context: string;
  goal: string;
  product_context: string;
};

type ResearchSource = {
  title: string;
  url: string;
  note?: string;
};

type ParsedResearchContent = {
  approved?: boolean;
  title?: string;
  report_markdown?: string;
  sources?: ResearchSource[];
  reviewer_notes?: string;
};

type ResearchViewResult = {
  approved: boolean;
  title: string;
  report_markdown: string;
  sources: ResearchSource[];
  reviewer_notes: string;
  tasks_output: string[];
  raw_result: any;
};

type BackgroundRun = {
  _id: string;
  crewName: string;
  title?: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  result?: any;
  error?: {
    message?: string;
    stack?: string;
  };
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

const exampleScenarios = [
  {
    title: 'SaaS CRM Growth Strategy',
    description:
      'Improve conversion and retention strategy for a B2B SaaS CRM product.',
    data: {
      topic: 'CRM strategy for SaaS startups',
      audience: 'VP Marketing',
      market: 'US B2B SaaS',
      business_context:
        'We sell CRM software to early-stage SaaS companies',
      goal: 'Improve demo-to-paid conversion and onboarding retention',
      product_context: 'CRM for SaaS sales teams',
    },
  },
  {
    title: 'Competitor Positioning Analysis',
    description:
      'Analyze positioning differences between major SaaS competitors.',
    data: {
      topic: 'Notion vs ClickUp positioning',
      audience: 'Product Marketing Manager',
      market: 'Global SaaS productivity tools',
      business_context:
        'We are building a productivity SaaS tool',
      goal: 'Identify positioning gaps and messaging opportunities',
      product_context: 'Task management + collaboration platform',
    },
  },
  {
    title: 'SEO Growth Strategy',
    description:
      'Find organic acquisition opportunities and content gaps.',
    data: {
      topic: 'SEO strategy for SaaS analytics tools',
      audience: 'Growth marketer',
      market: 'US SaaS',
      business_context:
        'We offer analytics dashboards for product teams',
      goal: 'Increase organic traffic and inbound leads',
      product_context: 'Product analytics SaaS',
    },
  },
];

function getErrorMessage(error: any, fallback: string) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}

function parseResearchRunResult(rawRunResult: any): ResearchViewResult {
  const rawResult = rawRunResult || {};

  const rawContent =
    rawResult?.result?.content ||
    rawResult?.content ||
    rawResult?.rawContent ||
    '';

  const tasksOutput = Array.isArray(rawResult?.result?.tasks_output)
    ? rawResult.result.tasks_output
    : Array.isArray(rawResult?.tasks_output)
      ? rawResult.tasks_output
      : [];

  let parsedContent: ParsedResearchContent = {};

  if (typeof rawContent === 'string' && rawContent.trim()) {
    try {
      parsedContent = JSON.parse(rawContent);
    } catch {
      const start = rawContent.indexOf('{');
      const end = rawContent.lastIndexOf('}');

      if (start !== -1 && end !== -1 && end > start) {
        try {
          parsedContent = JSON.parse(rawContent.slice(start, end + 1));
        } catch {
          parsedContent = {};
        }
      }
    }
  } else if (rawContent && typeof rawContent === 'object') {
    parsedContent = rawContent;
  }

  return {
    approved: Boolean(parsedContent?.approved),
    title: parsedContent?.title || '',
    report_markdown: parsedContent?.report_markdown || '',
    sources: Array.isArray(parsedContent?.sources)
      ? parsedContent.sources
      : [],
    reviewer_notes: parsedContent?.reviewer_notes || '',
    tasks_output: tasksOutput,
    raw_result: rawResult,
  };
}

const markdownToDocxParagraphs = (markdown: string) => {
  const lines = markdown.split('\n');
  const paragraphs: Paragraph[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      paragraphs.push(new Paragraph({ text: '' }));
      continue;
    }

    if (trimmed.startsWith('### ')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^###\s+/, ''),
              bold: true,
              size: 24,
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    if (trimmed.startsWith('## ')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^##\s+/, ''),
              bold: true,
              size: 28,
            }),
          ],
          spacing: { before: 280, after: 140 },
        })
      );
      continue;
    }

    if (trimmed.startsWith('# ')) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: trimmed.replace(/^#\s+/, ''),
              bold: true,
              size: 32,
            }),
          ],
          spacing: { before: 320, after: 180 },
        })
      );
      continue;
    }

    if (trimmed.startsWith('- ')) {
      paragraphs.push(
        new Paragraph({
          text: `• ${trimmed.replace(/^- /, '')}`,
          spacing: { after: 80 },
        })
      );
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      paragraphs.push(
        new Paragraph({
          text: trimmed,
          spacing: { after: 80 },
        })
      );
      continue;
    }

    paragraphs.push(
      new Paragraph({
        text: line,
        spacing: { after: 120 },
      })
    );
  }

  return paragraphs;
};

const ResearchPage = () => {
  const [serverError, setServerError] = useState('');
  const [result, setResult] = useState<ResearchViewResult | null>(null);
  const [isExampleModalOpen, setIsExampleModalOpen] = useState(false);

  const [runId, setRunId] = useState('');
  const [runStatus, setRunStatus] = useState('');
  const [isBackgroundRunning, setIsBackgroundRunning] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResearchCrewFormData>({
    defaultValues: {
      topic: '',
      audience: 'marketing manager',
      market: 'global market',
      business_context: '',
      goal: '',
      product_context: '',
    },
  });

  const isBusy = isSubmitting || isBackgroundRunning;

  const runStatusLabel = useMemo(() => {
    if (!runId) return '';

    if (runStatus === 'queued') return 'Queued';
    if (runStatus === 'running') return 'Running';
    if (runStatus === 'success') return 'Completed';
    if (runStatus === 'failed') return 'Failed';

    return runStatus || 'Queued';
  }, [runId, runStatus]);

  const handleExampleClick = (example: any) => {
    Object.entries(example.data).forEach(([key, value]) => {
      setValue(key as keyof ResearchCrewFormData, value as string);
    });

    setIsExampleModalOpen(false);
    setResult(null);
    setServerError('');
    setRunId('');
    setRunStatus('');
    setIsBackgroundRunning(false);
  };

  useEffect(() => {
    if (!runId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${runId}`);
        const run: BackgroundRun | undefined = response?.data?.data;

        if (!run) return;

        setRunStatus(run.status || '');

        if (run.status === 'success') {
          clearInterval(timer);
          setIsBackgroundRunning(false);

          const parsedResult = parseResearchRunResult(run.result);

          if (!parsedResult.report_markdown) {
            throw new Error(
              'Research completed, but the report markdown was empty or invalid.'
            );
          }

          setResult(parsedResult);

          setRunId('');
          setRunStatus('');

          return;
        }

        if (run.status === 'failed') {
          clearInterval(timer);
          setIsBackgroundRunning(false);

          const message = run?.error?.message || 'Research background task failed.';

          setServerError(message);
          setRunId('');
          setRunStatus('');

          return;
        }
      } catch (error: any) {
        clearInterval(timer);
        setIsBackgroundRunning(false);

        const message = getErrorMessage(
          error,
          'Research completed, but the result could not be loaded.'
        );

        setServerError(message);
        setRunId('');
        setRunStatus('');
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [runId]);

  const onSubmit = async (data: ResearchCrewFormData) => {
    try {
      setServerError('');
      setResult(null);
      setRunId('');
      setRunStatus('');
      setIsBackgroundRunning(false);

      const response = await api.post('/research', {
        topic: data.topic,
        audience: data.audience,
        market: data.market,
        business_context: data.business_context,
        goal: data.goal,
        product_context: data.product_context,
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

      const fallbackResult = parseResearchRunResult(responseData);

      if (!fallbackResult.report_markdown) {
        throw new Error('API did not return a research result or background run ID.');
      }

      setResult(fallbackResult);
    } catch (error: any) {
      const message = getErrorMessage(error, 'Failed to start research crew.');
      setServerError(message);
    }
  };

  const downloadPDF = async () => {
    if (typeof window === 'undefined' || !result?.report_markdown) return;

    const element = document.getElementById('research-export-content');
    if (!element) return;

    const html2pdf = (await import('html2pdf.js')).default;

    html2pdf()
      .from(element)
      .set({
        margin: 10,
        filename: `${(result.title || 'research-report')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')}.pdf`,
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .save();
  };

  const downloadDOCX = async () => {
    if (!result?.report_markdown) return;

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: result.title || 'Research Report',
                  bold: true,
                  size: 34,
                }),
              ],
              spacing: { after: 220 },
            }),

            ...(result.reviewer_notes
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Reviewer Notes: ${result.reviewer_notes}`,
                        italics: true,
                      }),
                    ],
                    spacing: { after: 200 },
                  }),
                ]
              : []),

            ...markdownToDocxParagraphs(result.report_markdown),

            ...(result.sources.length > 0
              ? [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Sources',
                        bold: true,
                        size: 28,
                      }),
                    ],
                    spacing: { before: 280, after: 160 },
                  }),
                  ...result.sources.flatMap((source) => [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: source.title || source.url,
                          bold: true,
                        }),
                      ],
                      spacing: { after: 60 },
                    }),
                    new Paragraph({
                      text: source.url,
                      spacing: { after: 60 },
                    }),
                    ...(source.note
                      ? [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: source.note,
                              }),
                            ],
                            spacing: { after: 140 },
                          }),
                        ]
                      : []),
                  ]),
                ]
              : []),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `${(result.title || 'research-report')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')}.docx`;

    saveAs(blob, filename);
  };

  return (
    <DashboardLayout>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setIsExampleModalOpen(true)}
          disabled={isBusy}
        >
          View Examples
        </button>
      </div>

      {isExampleModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="mb-2 text-lg font-bold">Example Use Cases</h3>

            <p className="mb-6 text-sm text-gray-500">
              Choose a scenario to auto-fill the form.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              {exampleScenarios.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="rounded-xl border border-gray-200 p-4 text-left transition hover:border-primary hover:bg-base-200 dark:border-gray-800"
                >
                  <h4 className="mb-1 font-semibold">{example.title}</h4>

                  <p className="text-sm text-gray-500">
                    {example.description}
                  </p>
                </button>
              ))}
            </div>

            <div className="modal-action">
              <button
                className="btn"
                onClick={() => setIsExampleModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>

          <div
            className="modal-backdrop"
            onClick={() => setIsExampleModalOpen(false)}
          />
        </div>
      )}

      <div className="py-8" dir="ltr">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Research Assistant
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Turn a rough topic into a specialized marketing research brief,
              run detailed research, and review the final moderated result.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {serverError}
              </div>
            )}

            {isBackgroundRunning && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <span className="loading loading-spinner loading-sm" />
                  <span>
                    Research is running in background. Status:{' '}
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
              placeholder="Best CRM strategy for B2B SaaS startups"
              error={errors.topic?.message}
              dir="ltr"
              autoFocus
              disabled={isBusy}
            />

            <Input
              {...register('audience', {
                required: 'Audience is required',
              })}
              type="text"
              label="Audience"
              placeholder="marketing manager"
              error={errors.audience?.message}
              dir="ltr"
              disabled={isBusy}
            />

            <Input
              {...register('market', {
                required: 'Market is required',
              })}
              type="text"
              label="Market"
              placeholder="US B2B SaaS"
              error={errors.market?.message}
              dir="ltr"
              disabled={isBusy}
            />

            <Input
              {...register('business_context')}
              type="text"
              label="Business Context"
              placeholder="We sell software to B2B SaaS teams."
              error={errors.business_context?.message}
              dir="ltr"
              disabled={isBusy}
            />

            <Input
              {...register('goal')}
              type="text"
              label="Goal"
              placeholder="Increase demo-to-paid conversion and improve retention."
              error={errors.goal?.message}
              dir="ltr"
              disabled={isBusy}
            />

            <Input
              {...register('product_context')}
              type="text"
              label="Product / Business Context"
              placeholder="CRM platform for early-stage SaaS sales teams."
              error={errors.product_context?.message}
              dir="ltr"
              disabled={isBusy}
            />

            <Button type="submit" isLoading={isBusy} disabled={isBusy}>
              {isBackgroundRunning
                ? 'Running in Background...'
                : 'Run Research Crew'}
            </Button>
          </form>

          {result?.report_markdown && (
            <div className="mt-8 space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={downloadPDF}>
                  Download PDF
                </Button>
                <Button type="button" onClick={downloadDOCX}>
                  Download Word
                </Button>
              </div>

              <div className="space-y-5 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Moderator Status:
                  </span>{' '}
                  <span
                    className={
                      result.approved
                        ? 'font-medium text-green-600 dark:text-green-400'
                        : 'font-medium text-red-600 dark:text-red-400'
                    }
                  >
                    {result.approved ? 'Approved' : 'Not Approved'}
                  </span>
                </div>

                {!!result.title && (
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {result.title}
                    </h2>
                  </div>
                )}

                {!!result.reviewer_notes && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      <span className="font-medium">Reviewer Notes:</span>{' '}
                      {result.reviewer_notes}
                    </p>
                  </div>
                )}

                <div id="research-export-content" className="space-y-6">
                  {!!result.title && (
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                        {result.title}
                      </h1>
                    </div>
                  )}

                  <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-blue-600 dark:prose-invert dark:prose-a:text-blue-400 md:prose-base">
                    <ReactMarkdown>{result.report_markdown}</ReactMarkdown>
                  </div>

                  {result.sources.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                        Sources
                      </h3>
                      <div className="space-y-3">
                        {result.sources.map((source, index) => (
                          <div
                            key={`${source.url}-${index}`}
                            className="rounded-lg border border-gray-200 p-3 dark:border-gray-800"
                          >
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="break-all text-sm font-medium text-blue-600 dark:text-blue-400"
                            >
                              {source.title || source.url}
                            </a>

                            {!!source.note && (
                              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                {source.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {result.tasks_output.length > 0 && (
                <div>
                  <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                    Tasks Output
                  </h3>

                  <div className="space-y-4">
                    {result.tasks_output.map((taskOutput, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950"
                      >
                        <div className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Task {index + 1}
                        </div>
                        <pre className="overflow-x-auto whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
                          {taskOutput}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                  Raw Result
                </h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                  {JSON.stringify(result.raw_result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default ResearchPage;