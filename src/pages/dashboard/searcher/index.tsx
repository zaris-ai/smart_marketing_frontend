import { DashboardLayout } from '@/components/layouts';
import { Button, Input } from '@/components/ui';
import api from '@/lib/axios';
import { useState } from 'react';
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


  const handleExampleClick = (example: any) => {
    Object.entries(example.data).forEach(([key, value]) => {
      setValue(key as any, value);
    });

    setIsExampleModalOpen(false);
    setResult(null);
    setServerError('');
  };

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

  const onSubmit = async (data: ResearchCrewFormData) => {
    try {
      setServerError('');
      setResult(null);

      const response = await api.post('/research', {
        topic: data.topic,
        audience: data.audience,
        market: data.market,
        business_context: data.business_context,
        goal: data.goal,
        product_context: data.product_context,
      });

      const apiData = response?.data?.data;
      const rawResult = apiData?.result || {};
      const rawContent = rawResult?.content;
      const tasksOutput = Array.isArray(rawResult?.tasks_output)
        ? rawResult.tasks_output
        : [];

      let parsedContent: ParsedResearchContent = {};

      if (typeof rawContent === 'string' && rawContent.trim()) {
        try {
          parsedContent = JSON.parse(rawContent);
        } catch (e) {
          console.log('Failed to parse result.content as JSON', e);
        }
      } else if (rawContent && typeof rawContent === 'object') {
        parsedContent = rawContent;
      }

      setResult({
        approved: Boolean(parsedContent?.approved),
        title: parsedContent?.title || '',
        report_markdown: parsedContent?.report_markdown || '',
        sources: Array.isArray(parsedContent?.sources)
          ? parsedContent.sources
          : [],
        reviewer_notes: parsedContent?.reviewer_notes || '',
        tasks_output: tasksOutput,
        raw_result: rawResult,
      });
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.error ||
        'Failed to run research crew.'
      );
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

      {/* modal */}
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => setIsExampleModalOpen(true)}
        >
          View Examples
        </button>
      </div>
      {isExampleModalOpen && (
        <div className="modal modal-open">
          <div className="modal-box max-w-3xl">
            <h3 className="font-bold text-lg mb-2">
              Example Use Cases
            </h3>

            <p className="text-sm text-gray-500 mb-6">
              Choose a scenario to auto-fill the form.
            </p>

            <div className="grid md:grid-cols-2 gap-4">
              {exampleScenarios.map((example, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  className="text-left border border-gray-200 dark:border-gray-800 rounded-xl p-4 hover:border-primary hover:bg-base-200 transition"
                >
                  <h4 className="font-semibold mb-1">
                    {example.title}
                  </h4>

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

          {/* backdrop */}
          <div
            className="modal-backdrop"
            onClick={() => setIsExampleModalOpen(false)}
          />
        </div>
      )}
      {/* modal */}
      <div className="py-8" dir="ltr">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
              Research Assistant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Turn a rough topic into a specialized marketing research brief, run detailed research, and review the final moderated result.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {serverError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {serverError}
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
            />

            <Input
              {...register('business_context')}
              type="text"
              label="Business Context"
              placeholder="We sell software to B2B SaaS teams."
              error={errors.business_context?.message}
              dir="ltr"
            />

            <Input
              {...register('goal')}
              type="text"
              label="Goal"
              placeholder="Increase demo-to-paid conversion and improve retention."
              error={errors.goal?.message}
              dir="ltr"
            />

            <Input
              {...register('product_context')}
              type="text"
              label="Product / Business Context"
              placeholder="CRM platform for early-stage SaaS sales teams."
              error={errors.product_context?.message}
              dir="ltr"
            />

            <Button type="submit" isLoading={isSubmitting}>
              Run Research Crew
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

              <div className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-5">
                <div>
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                    Moderator Status:
                  </span>{' '}
                  <span
                    className={
                      result.approved
                        ? 'text-green-600 dark:text-green-400 font-medium'
                        : 'text-red-600 dark:text-red-400 font-medium'
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

                  <div className="prose prose-sm md:prose-base max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-blue-600 dark:prose-a:text-blue-400">
                    <ReactMarkdown>{result.report_markdown}</ReactMarkdown>
                  </div>

                  {result.sources.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                        Sources
                      </h3>
                      <div className="space-y-3">
                        {result.sources.map((source, index) => (
                          <div
                            key={`${source.url}-${index}`}
                            className="border border-gray-200 dark:border-gray-800 rounded-lg p-3"
                          >
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm font-medium text-blue-600 dark:text-blue-400 break-all"
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
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Tasks Output
                  </h3>

                  <div className="space-y-4">
                    {result.tasks_output.map((taskOutput, index) => (
                      <div
                        key={index}
                        className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4"
                      >
                        <div className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Task {index + 1}
                        </div>
                        <pre className="text-sm overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                          {taskOutput}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Raw Result
                </h3>
                <pre className="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl p-4 text-sm overflow-x-auto whitespace-pre-wrap text-gray-800 dark:text-gray-200">
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