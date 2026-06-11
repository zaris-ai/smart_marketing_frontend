type StoreCrm = {
    funnelStage?: string;
    leadStatus?: string;
    fitScore?: number;
    priority?: string;
    painAngle?: string;
    nextFollowUpAt?: string | null;
  };
  
  type StoreLead = {
    _id: string;
    name: string;
    domain: string;
    contactEmail?: string;
    updatedAt?: string;
    createdAt?: string;
    crm?: StoreCrm;
    metadata?: {
      contactDiscovery?: {
        primaryEmail?: string;
      };
    };
  };
  
  type FunnelEvent = {
    _id: string;
    type: string;
    title?: string;
    description?: string;
    previousStage?: string;
    nextStage?: string;
    previousStatus?: string;
    nextStatus?: string;
    channel?: string;
    createdAt?: string;
  };
  
  type StoreTrackingTrendProps = {
    store: StoreLead;
    events?: FunnelEvent[];
    compact?: boolean;
  };
  
  type StageKey =
    | 'lost'
    | 'discovered'
    | 'qualified'
    | 'contacted'
    | 'engaged'
    | 'installed'
    | 'activated'
    | 'won';
  
  type StageMeta = {
    key: StageKey;
    score: number;
    label: string;
    description: string;
  };
  
  type TrendPoint = {
    id: string;
    stage: StageKey;
    status: string;
    score: number;
    label: string;
    dateLabel: string;
    description: string;
  };
  
  const LEGACY_STAGE_MAP: Record<string, StageKey> = {
    contact_found: 'qualified',
    outreach_ready: 'qualified',
    interested: 'engaged',
    install_link_sent: 'engaged',
    retained: 'won',
  };
  
  const LEGACY_STATUS_MAP: Record<string, string> = {
    contact_found: 'qualified',
    replied_positive: 'replied',
    replied_neutral: 'replied',
    replied_negative: 'lost',
    bounced: 'lost',
    demo_requested: 'replied',
    pricing_requested: 'replied',
    install_link_sent: 'install_sent',
    installed_no_data: 'installed',
    installed_no_activation: 'installed',
    active_user: 'active',
    not_interested: 'lost',
    churned: 'lost',
  };
  
  const CRM_STAGE_FLOW: StageMeta[] = [
    {
      key: 'lost',
      score: -1,
      label: 'Lost',
      description: 'Rejected, unqualified, bounced, or churned',
    },
    {
      key: 'discovered',
      score: 0,
      label: 'Discovered',
      description: 'Store exists in CRM',
    },
    {
      key: 'qualified',
      score: 1,
      label: 'Qualified',
      description: 'Store is worth outreach',
    },
    {
      key: 'contacted',
      score: 2,
      label: 'Contacted',
      description: 'Outreach sent',
    },
    {
      key: 'engaged',
      score: 3,
      label: 'Engaged',
      description: 'Merchant replied or showed interest',
    },
    {
      key: 'installed',
      score: 4,
      label: 'Installed',
      description: 'App installed',
    },
    {
      key: 'activated',
      score: 5,
      label: 'Activated',
      description: 'Store used/synced/viewed value',
    },
    {
      key: 'won',
      score: 6,
      label: 'Won',
      description: 'Commercially successful',
    },
  ];
  
  const STAGE_BY_KEY = CRM_STAGE_FLOW.reduce<Record<string, StageMeta>>((acc, stage) => {
    acc[stage.key] = stage;
    return acc;
  }, {});
  
  function humanize(value?: string | null) {
    if (!value) return '-';
  
    return String(value)
      .replace(/_/g, ' ')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  function formatDate(value?: string | null) {
    if (!value) return '-';
  
    const date = new Date(value);
  
    if (Number.isNaN(date.getTime())) return '-';
  
    return date.toLocaleDateString();
  }
  
  function getPrimaryEmail(store: StoreLead) {
    return store.contactEmail || store.metadata?.contactDiscovery?.primaryEmail || '';
  }
  
  function normalizeStage(value?: string | null): StageKey {
    const cleanValue = String(value || 'discovered').trim();
  
    if (LEGACY_STAGE_MAP[cleanValue]) return LEGACY_STAGE_MAP[cleanValue];
  
    if (STAGE_BY_KEY[cleanValue]) return cleanValue as StageKey;
  
    return 'discovered';
  }
  
  function normalizeStatus(value?: string | null) {
    const cleanValue = String(value || 'new').trim();
  
    return LEGACY_STATUS_MAP[cleanValue] || cleanValue || 'new';
  }
  
  function getStageScore(stage?: string | null) {
    const normalizedStage = normalizeStage(stage);
  
    return STAGE_BY_KEY[normalizedStage]?.score ?? 0;
  }
  
  function getPointColor(stage: StageKey) {
    if (stage === 'lost') return 'text-error';
    if (['won', 'activated'].includes(stage)) return 'text-success';
    if (['contacted', 'engaged', 'installed'].includes(stage)) return 'text-info';
    if (stage === 'qualified') return 'text-primary';
  
    return 'text-base-content';
  }
  
  function getBadgeClass(stage?: string | null) {
    const normalizedStage = normalizeStage(stage);
  
    if (normalizedStage === 'lost') return 'badge-error';
    if (['won', 'activated'].includes(normalizedStage)) return 'badge-success';
    if (['contacted', 'engaged', 'installed'].includes(normalizedStage)) return 'badge-info';
    if (normalizedStage === 'qualified') return 'badge-primary';
  
    return 'badge-ghost';
  }
  
  function buildTrendPoints(store: StoreLead, events: FunnelEvent[] = []): TrendPoint[] {
    const sortedEvents = [...events].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  
      return aTime - bTime;
    });
  
    const eventPoints = sortedEvents
      .filter((event) => event.nextStage || event.previousStage)
      .map((event, index) => {
        const normalizedStage = normalizeStage(event.nextStage || event.previousStage);
        const normalizedStatus = normalizeStatus(
          event.nextStatus || event.previousStatus || store.crm?.leadStatus || 'new'
        );
  
        return {
          id: event._id || `${normalizedStage}-${index}`,
          stage: normalizedStage,
          status: normalizedStatus,
          score: getStageScore(normalizedStage),
          label: event.title || humanize(event.type),
          dateLabel: formatDate(event.createdAt),
          description: event.description || STAGE_BY_KEY[normalizedStage]?.description || '',
        };
      });
  
    if (eventPoints.length > 0) {
      return eventPoints;
    }
  
    const currentStage = normalizeStage(store.crm?.funnelStage);
  
    return [
      {
        id: `${store._id}-current`,
        stage: currentStage,
        status: normalizeStatus(store.crm?.leadStatus || 'new'),
        score: getStageScore(currentStage),
        label: 'Current CRM State',
        dateLabel: formatDate(store.updatedAt || store.createdAt),
        description:
          'No timeline events were found. This point is based on the current store CRM state.',
      },
    ];
  }
  
  export default function StoreTrackingTrend({
    store,
    events = [],
    compact = false,
  }: StoreTrackingTrendProps) {
    const points = buildTrendPoints(store, events);
  
    const width = Math.max(compact ? 620 : 960, points.length * 140);
    const height = compact ? 260 : 360;
    const paddingLeft = 82;
    const paddingRight = 42;
    const paddingTop = 28;
    const paddingBottom = 64;
  
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
  
    const minScore = -1;
    const maxScore = 6;
  
    const currentStage = normalizeStage(store.crm?.funnelStage);
    const currentStatus = normalizeStatus(store.crm?.leadStatus || 'new');
  
    const getX = (index: number) => {
      if (points.length <= 1) return paddingLeft + chartWidth / 2;
  
      return paddingLeft + (index / (points.length - 1)) * chartWidth;
    };
  
    const getY = (score: number) => {
      const normalized = (score - minScore) / (maxScore - minScore);
  
      return paddingTop + chartHeight - normalized * chartHeight;
    };
  
    const polylinePoints = points
      .map((point, index) => `${getX(index)},${getY(point.score)}`)
      .join(' ');
  
    const axisStages = CRM_STAGE_FLOW;
  
    return (
      <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-lg font-bold text-base-content">
                {store.name}
              </h3>
  
              <span className={`badge badge-outline ${getBadgeClass(currentStage)}`}>
                {humanize(currentStage)}
              </span>
  
              <span className="badge badge-ghost">{humanize(currentStatus)}</span>
            </div>
  
            <div className="mt-1 text-sm text-base-content/60">
              {store.domain} · {getPrimaryEmail(store) || 'No email'}
            </div>
          </div>
  
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-outline">Score {store.crm?.fitScore || 0}</span>
  
            <span className="badge badge-outline">
              {humanize(store.crm?.priority || 'medium')}
            </span>
  
            <span className="badge badge-outline">
              {points.length} point{points.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
  
        <div className="w-full overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="max-w-none"
            role="img"
            aria-label={`CRM tracking trend for ${store.name}`}
          >
            <rect
              x={0}
              y={0}
              width={width}
              height={height}
              rx={24}
              className="fill-base-200/40"
            />
  
            {axisStages.map((stage) => {
              const y = getY(stage.score);
  
              return (
                <g key={stage.key}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    className="stroke-base-300"
                    strokeDasharray="4 5"
                  />
  
                  <text
                    x={16}
                    y={y + 4}
                    className="fill-base-content/60 text-[11px]"
                  >
                    {stage.label}
                  </text>
                </g>
              );
            })}
  
            <line
              x1={paddingLeft}
              y1={paddingTop}
              x2={paddingLeft}
              y2={height - paddingBottom}
              className="stroke-base-300"
            />
  
            <line
              x1={paddingLeft}
              y1={height - paddingBottom}
              x2={width - paddingRight}
              y2={height - paddingBottom}
              className="stroke-base-300"
            />
  
            {points.length > 1 && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={currentStage === 'lost' ? 'text-error' : 'text-primary'}
              />
            )}
  
            {points.map((point, index) => {
              const x = getX(index);
              const y = getY(point.score);
              const isLost = point.stage === 'lost';
  
              return (
                <g key={point.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={8}
                    className={isLost ? 'fill-error' : 'fill-primary'}
                  />
  
                  <circle
                    cx={x}
                    cy={y}
                    r={14}
                    fill="none"
                    className={isLost ? 'stroke-error/30' : 'stroke-primary/30'}
                    strokeWidth={6}
                  />
  
                  <text
                    x={x}
                    y={height - paddingBottom + 24}
                    textAnchor="middle"
                    className="fill-base-content/70 text-[11px]"
                  >
                    {point.dateLabel}
                  </text>
  
                  <text
                    x={x}
                    y={height - paddingBottom + 42}
                    textAnchor="middle"
                    className="fill-base-content text-[11px] font-semibold"
                  >
                    {humanize(point.stage).slice(0, 14)}
                  </text>
  
                  <title>
                    {`${point.label}
  Stage: ${humanize(point.stage)}
  Status: ${humanize(point.status)}
  Date: ${point.dateLabel}
  ${point.description}`}
                  </title>
                </g>
              );
            })}
          </svg>
        </div>
  
        {!compact && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {points.map((point) => (
              <div
                key={point.id}
                className="rounded-2xl border border-base-300 bg-base-200/50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge badge-outline ${getBadgeClass(point.stage)}`}>
                    {humanize(point.stage)}
                  </span>
  
                  <span className="badge badge-ghost">{point.dateLabel}</span>
                </div>
  
                <div className="mt-2 font-semibold text-base-content">{point.label}</div>
  
                <div className={`mt-1 text-sm font-medium ${getPointColor(point.stage)}`}>
                  {humanize(point.status)}
                </div>
  
                {point.description && (
                  <p className="mt-2 text-sm leading-6 text-base-content/70">
                    {point.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }