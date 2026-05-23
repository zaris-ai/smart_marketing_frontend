import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import { toast } from 'sonner';

import {
  ArrowPathIcon,
  ArrowsPointingOutIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

import api from '@/lib/axios';

type ChatRole = 'user' | 'assistant';

type RouteLink = {
  label: string;
  href: string;
};

type ChatMessage = {
  role: ChatRole;
  content: string;
  type?: 'text' | 'html';
  html?: string;
  confidence?: 'high' | 'medium' | 'low';
  sources?: string[];
  links?: RouteLink[];
};

type ChatSize = {
  width: number;
  height: number;
};

type AgentPayload = {
  type?: 'text' | 'html';
  answer?: string;
  html?: string;
  links?: RouteLink[];
  sources?: string[];
  confidence?: 'high' | 'medium' | 'low';
};

type PanelChatResponse = {
  success: boolean;
  message: string;
  data?: {
    answer: string;
    crew?: string;
    tasksOutput?: string[];
  };
};

const CHAT_MESSAGES_KEY = 'panel-agent-chat-messages-v5';
const CHAT_SIZE_KEY = 'panel-agent-chat-size-v2';

const DEFAULT_SIZE: ChatSize = {
  width: 430,
  height: 660,
};

const MIN_SIZE: ChatSize = {
  width: 340,
  height: 460,
};

const MAX_SIZE: ChatSize = {
  width: 820,
  height: 860,
};

const DEFAULT_MESSAGES: ChatMessage[] = [
  {
    role: 'assistant',
    type: 'text',
    content:
      'Hi 👋 Ask me about Arka, Shopify analytics, SEO tools, blog workflows, or panel features.',
    links: [],
  },
];

const ALLOWED_PANEL_ROUTES = [
  '/dashboard',
  '/dashboard/blog',
  '/dashboard/competitor',
  '/dashboard/emails',
  '/dashboard/instagram',
  '/dashboard/instagram_post',
  '/dashboard/manage_competitor',
  '/dashboard/manual-blogs',
  '/dashboard/outreach',
  '/dashboard/problem_discovery',
  '/dashboard/runs',
  '/dashboard/searcher',
  '/dashboard/seo',
  '/dashboard/seoKeyword',
  '/dashboard/smart_blog',
  '/dashboard/smart_blog/managment',
  '/dashboard/stores',
  '/dashboard/trends',
  '/dashboard/uploader',
  '/dashboard/users',
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSafeInternalRoute(href: string) {
  if (!href) return false;
  if (!href.startsWith('/')) return false;
  if (href.startsWith('//')) return false;
  if (href.includes('://')) return false;
  if (href.toLowerCase().includes('javascript:')) return false;
  if (href.includes('[') || href.includes(']')) return false;

  const cleanPath = href.split('?')[0].split('#')[0];

  return ALLOWED_PANEL_ROUTES.some((route) => {
    return cleanPath === route || cleanPath.startsWith(`${route}/`);
  });
}

function normalizeLinks(value: unknown): RouteLink[] {
  if (!Array.isArray(value)) return [];

  const unique = new Map<string, RouteLink>();

  value.forEach((item) => {
    const record = item as { label?: unknown; href?: unknown };

    const label = String(record?.label || 'Open page').trim();
    const href = String(record?.href || '').trim();

    if (!label || !isSafeInternalRoute(href)) return;

    unique.set(href, {
      label,
      href,
    });
  });

  return Array.from(unique.values()).slice(0, 3);
}

function extractFirstJsonObject(text: string) {
  const start = text.indexOf('{');

  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }

      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;

    if (depth === 0) {
      return text.slice(start, i + 1);
    }
  }

  return null;
}

function parseAgentAnswer(raw: string): ChatMessage {
  const fallback: ChatMessage = {
    role: 'assistant',
    type: 'text',
    content: raw || 'I could not find that in the current knowledge base.',
    links: [],
  };

  if (!raw) return fallback;

  try {
    const jsonText = extractFirstJsonObject(raw) || raw;

    const parsed = JSON.parse(jsonText) as AgentPayload;

    const answer = String(parsed.answer || '').trim();
    const html = String(parsed.html || '').trim();
    const type = parsed.type === 'html' && html ? 'html' : 'text';

    return {
      role: 'assistant',
      type,
      content: answer || fallback.content,
      html: type === 'html' ? html : '',
      links: normalizeLinks(parsed.links),
      sources: Array.isArray(parsed.sources) ? parsed.sources : [],
      confidence: parsed.confidence || undefined,
    };
  } catch {
    return fallback;
  }
}

function safeParseMessages(value: string | null): ChatMessage[] {
  if (!value) return DEFAULT_MESSAGES;

  try {
    const parsed = JSON.parse(value);

    if (!Array.isArray(parsed)) return DEFAULT_MESSAGES;

    const messages = parsed
      .map((item) => {
        const record = item as {
          role?: unknown;
          content?: unknown;
          type?: unknown;
          html?: unknown;
          confidence?: unknown;
          sources?: unknown;
          links?: unknown;
        };

        return {
          role: record?.role === 'user' ? 'user' : 'assistant',
          content: String(record?.content || '').trim(),
          type: record?.type === 'html' ? 'html' : 'text',
          html: String(record?.html || '').trim(),
          confidence:
            record?.confidence === 'high' ||
            record?.confidence === 'medium' ||
            record?.confidence === 'low'
              ? record.confidence
              : undefined,
          sources: Array.isArray(record?.sources) ? record.sources : [],
          links: normalizeLinks(record?.links),
        } as ChatMessage;
      })
      .filter((item) => item.content);

    return messages.length ? messages : DEFAULT_MESSAGES;
  } catch {
    return DEFAULT_MESSAGES;
  }
}

function safeParseSize(value: string | null): ChatSize {
  if (!value) return DEFAULT_SIZE;

  try {
    const parsed = JSON.parse(value);

    return {
      width: clamp(
        Number(parsed?.width || DEFAULT_SIZE.width),
        MIN_SIZE.width,
        MAX_SIZE.width
      ),
      height: clamp(
        Number(parsed?.height || DEFAULT_SIZE.height),
        MIN_SIZE.height,
        MAX_SIZE.height
      ),
    };
  } catch {
    return DEFAULT_SIZE;
  }
}

function TypingLoader() {
  return (
    <div className="flex items-center gap-1">
      <span className="panel-chat-dot" />
      <span className="panel-chat-dot panel-chat-dot-delay-1" />
      <span className="panel-chat-dot panel-chat-dot-delay-2" />
    </div>
  );
}

function ConfidenceBadge({
  confidence,
}: {
  confidence?: 'high' | 'medium' | 'low';
}) {
  if (!confidence) return null;

  const label = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
  }[confidence];

  return (
    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
      {label}
    </span>
  );
}

export default function PanelAgentChatbot() {
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState<ChatSize>(DEFAULT_SIZE);
  const [messages, setMessages] = useState<ChatMessage[]>(DEFAULT_MESSAGES);
  const [previewMessageIndex, setPreviewMessageIndex] = useState<number | null>(
    null
  );
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(
    null
  );

  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const resizeStartRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    setMessages(
      safeParseMessages(window.localStorage.getItem(CHAT_MESSAGES_KEY))
    );

    setSize(safeParseSize(window.localStorage.getItem(CHAT_SIZE_KEY)));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    window.localStorage.setItem(
      CHAT_MESSAGES_KEY,
      JSON.stringify(messages.slice(-50))
    );
  }, [messages, mounted]);

  useEffect(() => {
    if (!mounted) return;

    window.localStorage.setItem(CHAT_SIZE_KEY, JSON.stringify(size));
  }, [size, mounted]);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!scrollRef.current) return;

    scrollRef.current.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages, loading, open]);

  useEffect(() => {
    function handlePointerMove(event: globalThis.PointerEvent) {
      if (!resizeStartRef.current) return;

      const start = resizeStartRef.current;

      const nextWidth = clamp(
        start.width + (start.x - event.clientX),
        MIN_SIZE.width,
        Math.min(MAX_SIZE.width, window.innerWidth - 32)
      );

      const nextHeight = clamp(
        start.height + (start.y - event.clientY),
        MIN_SIZE.height,
        Math.min(MAX_SIZE.height, window.innerHeight - 32)
      );

      setSize({
        width: nextWidth,
        height: nextHeight,
      });
    }

    function handlePointerUp() {
      resizeStartRef.current = null;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  const canSend = useMemo(() => {
    return question.trim().length > 0 && !loading;
  }, [question, loading]);

  async function copyToClipboard(
    value: string,
    successMessage = 'Copied'
  ) {
    const text = value.trim();

    if (!text) {
      toast.error('Nothing to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMessage);
    } catch {
      toast.error('Copy failed');
    }
  }

  function handleSaveChat() {
    window.localStorage.setItem(
      CHAT_MESSAGES_KEY,
      JSON.stringify(messages.slice(-50))
    );

    window.localStorage.setItem(
      CHAT_SIZE_KEY,
      JSON.stringify(size)
    );

    toast.success('Chat saved');
  }

  function handleDeleteChat() {
    setMessages(DEFAULT_MESSAGES);
    setQuestion('');
    setPreviewMessageIndex(null);
    setEditingMessageIndex(null);

    window.localStorage.removeItem(CHAT_MESSAGES_KEY);

    toast.success('Chat deleted');
  }

  function handleResetSize() {
    setSize(DEFAULT_SIZE);
    toast.success('Chat size reset');
  }

  function handleResizeStart(
    event: ReactPointerEvent<HTMLButtonElement>
  ) {
    event.preventDefault();

    resizeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      width: size.width,
      height: size.height,
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'nwse-resize';
  }

  function handleRouteClick(link: RouteLink) {
    if (!isSafeInternalRoute(link.href)) {
      toast.error('Unsafe route blocked');
      return;
    }

    router.push(link.href);
    setOpen(false);
  }

  function handleEditMessage(index: number) {
    const message = messages[index];

    if (!message || message.role !== 'user') return;

    setQuestion(message.content);
    setEditingMessageIndex(index);
    setOpen(true);

    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
  }

  function handleCancelEdit() {
    setEditingMessageIndex(null);
    setQuestion('');
  }

  async function sendQuestion(
    text: string,
    baseMessages: ChatMessage[]
  ) {
    const userMessage: ChatMessage = {
      role: 'user',
      type: 'text',
      content: text,
      links: [],
    };

    const nextMessages = [...baseMessages, userMessage];

    setMessages(nextMessages);
    setQuestion('');
    setLoading(true);

    try {
      const response = await api.post<PanelChatResponse>(
        '/panel-chat/ask',
        {
          question: text,
          history: nextMessages.slice(-8).map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }
      );

      const rawAnswer =
        response.data?.data?.answer ||
        'I could not find that in the current knowledge base.';

      const parsedAnswer = parseAgentAnswer(rawAnswer);

      setMessages((current) => [...current, parsedAnswer]);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        'Panel agent failed to answer.';

      toast.error(message);

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          type: 'text',
          content:
            'Sorry, I could not answer right now. Please check the backend and Python crew logs.',
          links: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendMessage(index: number) {
    if (loading) return;

    const message = messages[index];

    if (!message || message.role !== 'user') return;

    setEditingMessageIndex(null);
    setQuestion('');

    await sendQuestion(message.content, messages);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const text = question.trim();

    if (!text || loading) return;

    if (editingMessageIndex !== null) {
      const baseMessages = messages.slice(0, editingMessageIndex);

      setEditingMessageIndex(null);

      await sendQuestion(text, baseMessages);

      toast.success('Message edited and resent');

      return;
    }

    await sendQuestion(text, messages);
  }

  if (!mounted) return null;

  const previewMessage =
    previewMessageIndex !== null
      ? messages[previewMessageIndex]
      : null;

  return createPortal(
    <>
      <style>{`
        @keyframes panelChatPop {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }

          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes panelChatDot {
          0%, 80%, 100% {
            opacity: 0.35;
            transform: translateY(0);
          }

          40% {
            opacity: 1;
            transform: translateY(-4px);
          }
        }

        @keyframes panelChatSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .panel-chat-pop {
          animation: panelChatPop 180ms ease-out both;
        }

        .panel-chat-fab {
          transition:
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .panel-chat-fab:hover {
          transform: translateY(-2px);
        }

        .panel-chat-dot {
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: #64748b;
          animation: panelChatDot 1.4s ease-in-out infinite;
        }

        .panel-chat-dot-delay-1 {
          animation-delay: 0.15s;
        }

        .panel-chat-dot-delay-2 {
          animation-delay: 0.3s;
        }

        .panel-chat-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.45);
          border-top-color: #fff;
          border-radius: 9999px;
          animation: panelChatSpin 700ms linear infinite;
        }
      `}</style>

      <div
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6"
        style={{ zIndex: 9999 }}
      >
        {open ? (
          <div
            className="panel-chat-pop relative flex max-h-[calc(100vh-32px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
            style={{
              width: size.width,
              height: size.height,
            }}
          >
            <button
              type="button"
              onPointerDown={handleResizeStart}
              className="absolute left-3 top-3 z-20 flex h-8 w-8 cursor-nwse-resize items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/25"
            >
              <ArrowsPointingOutIcon className="h-4 w-4" />
            </button>

            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 px-4 py-4 pl-14 text-white">
              <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10" />

              <div className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/10" />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 backdrop-blur">
                    <ChatBubbleLeftRightIcon className="h-6 w-6" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">
                        Panel Agent
                      </p>

                      <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.9)]" />
                    </div>

                    <p className="text-xs text-white/75">
                      Arka marketing assistant
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSaveChat}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    💾
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteChat}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-red-500/70"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleResetSize}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    ↺
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-4 py-4"
            >
              {messages.map((message, index) => {
                const isUser = message.role === 'user';

                const isEditing =
                  editingMessageIndex === index;

                const isWelcomeMessage =
                  index === 0 &&
                  message.role === 'assistant';

                const hasHtml =
                  message.role === 'assistant' &&
                  message.type === 'html' &&
                  Boolean(message.html);

                return (
                  <div
                    key={`${message.role}-${index}`}
                    className={`flex ${
                      isUser
                        ? 'justify-end'
                        : 'justify-start'
                    }`}
                  >
                    <div
                      className={[
                        'max-w-[88%] rounded-3xl px-4 py-3 text-sm leading-6',
                        isUser
                          ? isEditing
                            ? 'rounded-br-md bg-amber-500 text-white ring-4 ring-amber-100'
                            : 'rounded-br-md bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg'
                          : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800 shadow-[0_2px_10px_rgba(15,23,42,0.04)]',
                      ].join(' ')}
                    >
                      <div
                        className="whitespace-pre-wrap"
                        dir="auto"
                      >
                        {message.content}
                      </div>

                      {!isWelcomeMessage ? (
                        <div
                          className={[
                            'mt-2 flex flex-wrap items-center gap-2',
                            isUser
                              ? 'justify-end'
                              : 'justify-start',
                          ].join(' ')}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              copyToClipboard(
                                message.content,
                                isUser
                                  ? 'Question copied'
                                  : 'Answer copied'
                              )
                            }
                            className={[
                              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition',
                              isUser
                                ? 'bg-white/15 text-white hover:bg-white/25'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                            ].join(' ')}
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                            Copy
                          </button>

                          {isUser ? (
                            <>
                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  handleEditMessage(index)
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
                              >
                                <PencilSquareIcon className="h-3.5 w-3.5" />
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={loading}
                                onClick={() =>
                                  handleResendMessage(index)
                                }
                                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
                              >
                                <ArrowPathIcon className="h-3.5 w-3.5" />
                                Resend
                              </button>
                            </>
                          ) : (
                            <>
                              <ConfidenceBadge
                                confidence={
                                  message.confidence
                                }
                              />

                              {message.sources?.length ? (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                  {message.sources.length}{' '}
                                  source
                                  {message.sources.length > 1
                                    ? 's'
                                    : ''}
                                </span>
                              ) : null}

                              {hasHtml ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewMessageIndex(
                                        index
                                      )
                                    }
                                    className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:bg-blue-100"
                                  >
                                    View HTML
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      copyToClipboard(
                                        message.html || '',
                                        'HTML copied'
                                      )
                                    }
                                    className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-200"
                                  >
                                    Copy HTML
                                  </button>
                                </>
                              ) : null}
                            </>
                          )}
                        </div>
                      ) : null}

                      {!isUser &&
                      message.links?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.links.map((link) => (
                            <button
                              type="button"
                              key={`${link.href}-${link.label}`}
                              onClick={() =>
                                handleRouteClick(link)
                              }
                              className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                            >
                              {link.label}

                              <span aria-hidden="true">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-3xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <TypingLoader />
                  </div>
                </div>
              ) : null}
            </div>

            <form
              onSubmit={handleSubmit}
              className="border-t border-slate-200 bg-white p-3"
            >
              {editingMessageIndex !== null ? (
                <div className="mb-2 flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>
                    Editing previous question.
                    Sending will replace the
                    conversation after it.
                  </span>

                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="font-bold text-amber-900 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1.5 transition focus-within:border-blue-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
                <input
                  ref={inputRef}
                  value={question}
                  onChange={(event) =>
                    setQuestion(event.target.value)
                  }
                  placeholder={
                    editingMessageIndex !== null
                      ? 'Edit and resend your question...'
                      : 'Ask a short question...'
                  }
                  className="h-10 flex-1 bg-transparent px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  dir="auto"
                />

                <button
                  type="submit"
                  disabled={!canSend}
                  className={[
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:bg-slate-300',
                    editingMessageIndex !== null
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-blue-600 hover:bg-blue-700',
                  ].join(' ')}
                >
                  {loading ? (
                    <span className="panel-chat-spinner" />
                  ) : (
                    <PaperAirplaneIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="panel-chat-fab group relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 text-white shadow-2xl"
            aria-label="Open panel agent chatbot"
          >
            <span className="absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2 border-white bg-emerald-400" />

            <ChatBubbleLeftRightIcon className="h-7 w-7" />
          </button>
        )}
      </div>

      {previewMessage?.html ? (
        <div
          className="fixed inset-0 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          style={{ zIndex: 9999 }}
        >
          <div className="flex h-[88vh] w-[min(1100px,96vw)] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  HTML Preview
                </p>

                <p className="text-xs text-slate-500">
                  Generated from technical
                  Markdown and reviewed by the
                  agent.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    copyToClipboard(
                      previewMessage.html || '',
                      'HTML copied'
                    )
                  }
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Copy HTML
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPreviewMessageIndex(null)
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <iframe
              title="Generated HTML preview"
              srcDoc={previewMessage.html}
              sandbox=""
              className="h-full w-full flex-1 bg-white"
            />
          </div>
        </div>
      ) : null}
    </>,
    document.body
  );
}