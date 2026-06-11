import { DashboardLayout } from '@/components/layouts';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Dispatch,
  FormEvent,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'sonner';

type Store = {
  _id: string;
  name: string;
  domain: string;
  country?: string;
  contactEmail?: string;
  isActive: boolean;
};

type AppealLevel = {
  key: string;
  label: string;
  score: number;
  priority: string;
  outcome: string;
  nextFollowUpDays: number | null;
  description: string;
};

type AppealMode = {
  key: string;
  label: string;
  description: string;
};

type FitSignal = {
  key: string;
  label: string;
  weight: number;
  description: string;
};

type RiskSignal = {
  key: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
};

type DataQualityLevel = {
  key: string;
  label: string;
  score: number;
  description: string;
};

type ContactReadiness = {
  key: string;
  label: string;
  description: string;
};

type SalesStage = {
  key: string;
  label: string;
  description: string;
};

type RecommendedAction = {
  key: string;
  label: string;
  description: string;
};

type SelectedAppeal = {
  activityId: string;

  appealLevelKey: string;
  appealLevel: AppealLevel | null;

  appealModeKeys: string[];
  appealModes: AppealMode[];

  fitSignalKeys: string[];
  fitSignals: FitSignal[];

  riskSignalKeys: string[];
  riskSignals: RiskSignal[];

  dataQualityKey: string;
  dataQuality: DataQualityLevel | null;

  contactReadinessKey: string;
  contactReadiness: ContactReadiness | null;

  salesStageKey: string;
  salesStage: SalesStage | null;

  recommendedActionKey: string;
  recommendedAction: RecommendedAction | null;

  note: string;

  baseScore: number;
  computedScore: number;
  priority: string;

  selectedAt: string | null;
};

type Summary = {
  totalActivities: number;
  hasEmailed: boolean;
  lastActivityAt: string | null;
  lastEmailAt: string | null;
  nextFollowUpAt: string | null;
  selectedAppeal?: SelectedAppeal | null;
};

type StoreCrmAnalysisDoc = {
  _id: string;
  store: string;
  storeName?: string;
  storeDomain?: string;
  title?: string;
  crewName?: string;
  status: 'success' | 'failed';
  error?: string;
  generatedAt?: string;
  createdAt: string;
  analysis?: any;
  result?: any;
  telegram?: {
    published: boolean;
    channelId: string;
    messageIds: number[];
    publishedAt?: string | null;
    error?: string;
  };
};

type SelectableCardItem = {
  key: string;
  label: string;
  description: string;
};

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function priorityBadge(priority?: string) {
  const map: Record<string, string> = {
    urgent: 'badge-error',
    high: 'badge-warning',
    normal: 'badge-info',
    low: 'badge-ghost',
    blocked: 'badge-neutral',
  };

  return map[priority || ''] || 'badge-ghost';
}

function riskBadge(severity?: string) {
  const map: Record<string, string> = {
    high: 'badge-error',
    medium: 'badge-warning',
    low: 'badge-info',
  };

  return map[severity || ''] || 'badge-ghost';
}

function getAnalysisData(doc: StoreCrmAnalysisDoc | null) {
  return doc?.analysis || doc?.result || null;
}

function SelectableCardGrid<T extends SelectableCardItem>({
  title,
  description,
  items,
  selectedKeys,
  onToggle,
  activeClassName,
  inactiveHoverClassName,
  rightBadge,
  columns = 'lg:grid-cols-4',
}: {
  title: string;
  description: string;
  items: T[];
  selectedKeys: string[];
  onToggle: (key: string) => void;
  activeClassName: string;
  inactiveHoverClassName: string;
  rightBadge?: (item: T) => React.ReactNode;
  columns?: string;
}) {
  return (
    <div className="mt-8">
      <h3 className="text-base font-semibold">{title}</h3>

      <p className="mt-1 text-sm text-base-content/70">{description}</p>

      <div className={`mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 ${columns}`}>
        {items.map((item) => {
          const active = selectedKeys.includes(item.key);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggle(item.key)}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? activeClassName
                  : `border-base-300 bg-base-100 ${inactiveHoverClassName}`
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{item.label}</div>
                {rightBadge ? rightBadge(item) : null}
              </div>

              <p className="mt-2 text-sm leading-6 text-base-content/70">
                {item.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function StoreCrmPage() {
  const router = useRouter();

  const storeId = useMemo(() => {
    const value = router.query.id;
    return typeof value === 'string' ? value : '';
  }, [router.query.id]);

  const [store, setStore] = useState<Store | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  const [appealLevels, setAppealLevels] = useState<AppealLevel[]>([]);
  const [appealModes, setAppealModes] = useState<AppealMode[]>([]);
  const [fitSignals, setFitSignals] = useState<FitSignal[]>([]);
  const [riskSignals, setRiskSignals] = useState<RiskSignal[]>([]);
  const [dataQualityLevels, setDataQualityLevels] = useState<
    DataQualityLevel[]
  >([]);
  const [contactReadiness, setContactReadiness] = useState<
    ContactReadiness[]
  >([]);
  const [salesStages, setSalesStages] = useState<SalesStage[]>([]);
  const [recommendedActions, setRecommendedActions] = useState<
    RecommendedAction[]
  >([]);

  const [selectedAppeal, setSelectedAppeal] =
    useState<SelectedAppeal | null>(null);

  const [selectedLevelKey, setSelectedLevelKey] = useState('');
  const [selectedModeKeys, setSelectedModeKeys] = useState<string[]>([]);
  const [selectedFitSignalKeys, setSelectedFitSignalKeys] = useState<string[]>(
    []
  );
  const [selectedRiskSignalKeys, setSelectedRiskSignalKeys] = useState<
    string[]
  >([]);
  const [selectedDataQualityKey, setSelectedDataQualityKey] =
    useState('unknown');
  const [selectedContactReadinessKey, setSelectedContactReadinessKey] =
    useState('needs_validation');
  const [selectedSalesStageKey, setSelectedSalesStageKey] =
    useState('new_lead');
  const [selectedRecommendedActionKey, setSelectedRecommendedActionKey] =
    useState('manual_research');
  const [note, setNote] = useState('');

  const [latestAnalysis, setLatestAnalysis] =
    useState<StoreCrmAnalysisDoc | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [analysisRunId, setAnalysisRunId] = useState('');
  const [analysisRunStatus, setAnalysisRunStatus] = useState('');

  const selectedLevel = useMemo(() => {
    return appealLevels.find((item) => item.key === selectedLevelKey) || null;
  }, [appealLevels, selectedLevelKey]);

  const selectedDataQuality = useMemo(() => {
    return (
      dataQualityLevels.find((item) => item.key === selectedDataQualityKey) ||
      null
    );
  }, [dataQualityLevels, selectedDataQualityKey]);

  const selectedContactReadiness = useMemo(() => {
    return (
      contactReadiness.find(
        (item) => item.key === selectedContactReadinessKey
      ) || null
    );
  }, [contactReadiness, selectedContactReadinessKey]);

  const selectedSalesStage = useMemo(() => {
    return (
      salesStages.find((item) => item.key === selectedSalesStageKey) || null
    );
  }, [salesStages, selectedSalesStageKey]);

  const selectedRecommendedAction = useMemo(() => {
    return (
      recommendedActions.find(
        (item) => item.key === selectedRecommendedActionKey
      ) || null
    );
  }, [recommendedActions, selectedRecommendedActionKey]);

  const analysisData = useMemo(() => {
    return getAnalysisData(latestAnalysis);
  }, [latestAnalysis]);

  const computedPreviewScore = useMemo(() => {
    if (!selectedLevel) return 0;

    const selectedFitSignals = fitSignals.filter((item) =>
      selectedFitSignalKeys.includes(item.key)
    );

    const selectedRisks = riskSignals.filter((item) =>
      selectedRiskSignalKeys.includes(item.key)
    );

    const fitBonus = selectedFitSignals.reduce((sum, item) => {
      return sum + Number(item.weight || 0);
    }, 0);

    const riskPenalty = selectedRisks.reduce((sum, item) => {
      if (item.severity === 'high') return sum + 20;
      if (item.severity === 'medium') return sum + 10;
      return sum + 5;
    }, 0);

    const dataQualityAdjustment = Math.round(
      (Number(selectedDataQuality?.score || 0) - 50) * 0.2
    );

    const finalScore =
      selectedLevel.score + fitBonus * 0.25 - riskPenalty + dataQualityAdjustment;

    return Math.max(0, Math.min(100, Math.round(finalScore)));
  }, [
    selectedLevel,
    fitSignals,
    riskSignals,
    selectedFitSignalKeys,
    selectedRiskSignalKeys,
    selectedDataQuality,
  ]);

  const toggleKey = (
    key: string,
    setter: Dispatch<SetStateAction<string[]>>
  ) => {
    setter((current) => {
      if (current.includes(key)) {
        return current.filter((item) => item !== key);
      }

      return [...current, key];
    });
  };

  const hydrateSelection = (nextSelectedAppeal: SelectedAppeal | null) => {
    if (!nextSelectedAppeal) {
      return;
    }

    setSelectedLevelKey(nextSelectedAppeal.appealLevelKey || '');
    setSelectedModeKeys(nextSelectedAppeal.appealModeKeys || []);
    setSelectedFitSignalKeys(nextSelectedAppeal.fitSignalKeys || []);
    setSelectedRiskSignalKeys(nextSelectedAppeal.riskSignalKeys || []);
    setSelectedDataQualityKey(
      nextSelectedAppeal.dataQualityKey || 'unknown'
    );
    setSelectedContactReadinessKey(
      nextSelectedAppeal.contactReadinessKey || 'needs_validation'
    );
    setSelectedSalesStageKey(nextSelectedAppeal.salesStageKey || 'new_lead');
    setSelectedRecommendedActionKey(
      nextSelectedAppeal.recommendedActionKey || 'manual_research'
    );
    setNote(nextSelectedAppeal.note || '');
  };

  const fetchPage = async () => {
    if (!storeId) return;

    try {
      setIsLoading(true);

      const response = await api.get(`/stores/${storeId}/crm-activities`, {
        params: {
          page: 1,
          limit: 20,
        },
      });

      const data = response?.data?.data || {};

      setStore(data.store || null);
      setSummary(data.summary || null);

      setAppealLevels(data.appealLevels || []);
      setAppealModes(data.appealModes || []);
      setFitSignals(data.fitSignals || []);
      setRiskSignals(data.riskSignals || []);
      setDataQualityLevels(data.dataQualityLevels || []);
      setContactReadiness(data.contactReadiness || []);
      setSalesStages(data.salesStages || []);
      setRecommendedActions(data.recommendedActions || []);

      setSelectedAppeal(data.selectedAppeal || null);
      setLatestAnalysis(data.latestAnalysis || null);

      if (data.selectedAppeal) {
        hydrateSelection(data.selectedAppeal);
      } else {
        const levels = data.appealLevels || [];
        const dataQuality = data.dataQualityLevels || [];
        const contacts = data.contactReadiness || [];
        const stages = data.salesStages || [];
        const actions = data.recommendedActions || [];

        setSelectedLevelKey(levels[2]?.key || levels[0]?.key || '');
        setSelectedDataQualityKey(dataQuality[4]?.key || 'unknown');
        setSelectedContactReadinessKey(contacts[3]?.key || 'needs_validation');
        setSelectedSalesStageKey(stages[0]?.key || 'new_lead');
        setSelectedRecommendedActionKey(actions[1]?.key || 'manual_research');
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to load store appeal data.';

      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!storeId) return;

    fetchPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  useEffect(() => {
    if (!analysisRunId) return;

    const timer = setInterval(async () => {
      try {
        const response = await api.get(`/background-runs/${analysisRunId}`);
        const run = response?.data?.data;

        if (!run) return;

        setAnalysisRunStatus(run.status || '');

        if (run.status === 'success') {
          clearInterval(timer);

          toast.success('CRM analysis completed.');

          setAnalysisRunId('');
          setAnalysisRunStatus('');

          await fetchPage();
        }

        if (run.status === 'failed') {
          clearInterval(timer);

          toast.error(run?.error?.message || 'CRM analysis failed.');

          setAnalysisRunId('');
          setAnalysisRunStatus('');
        }
      } catch {
        // Keep polling silently.
      }
    }, 4000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisRunId]);

  const handleSaveAppeal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!storeId) return;

    if (!selectedLevelKey) {
      toast.error('Select a store appeal level.');
      return;
    }

    try {
      setIsSaving(true);

      const response = await api.post(`/stores/${storeId}/crm-activities`, {
        appealLevelKey: selectedLevelKey,
        appealModeKeys: selectedModeKeys,
        fitSignalKeys: selectedFitSignalKeys,
        riskSignalKeys: selectedRiskSignalKeys,
        dataQualityKey: selectedDataQualityKey,
        contactReadinessKey: selectedContactReadinessKey,
        salesStageKey: selectedSalesStageKey,
        recommendedActionKey: selectedRecommendedActionKey,
        note,
      });

      toast.success(
        response?.data?.message || 'Store appeal classification saved.'
      );

      const nextSelectedAppeal = response?.data?.data?.selectedAppeal || null;

      if (nextSelectedAppeal) {
        setSelectedAppeal(nextSelectedAppeal);
        hydrateSelection(nextSelectedAppeal);
      }

      await fetchPage();
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to save store appeal classification.';

      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyzeCrm = async () => {
    if (!storeId) return;

    if (!selectedLevelKey) {
      toast.error('Select store appeal before running analysis.');
      return;
    }

    try {
      setIsAnalyzing(true);
      setAnalysisRunId('');
      setAnalysisRunStatus('');

      const response = await api.post(
        `/stores/${storeId}/crm-activities/analyze`
      );

      const runId = response?.data?.data?.runId || '';
      const status = response?.data?.data?.status || 'queued';

      setAnalysisRunId(runId);
      setAnalysisRunStatus(status);

      toast.success(
        response?.data?.message || 'CRM analysis started in background.'
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to start CRM analysis.';

      toast.error(message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="mx-auto max-w-7xl space-y-6">
          <div>
            <Link
              href="/dashboard/stores"
              className="text-sm text-primary hover:underline"
            >
              ← Back to Stores
            </Link>

            <h1 className="mt-3 text-2xl font-semibold text-base-content">
              Store Appeal Analysis
            </h1>

            <p className="mt-1 text-sm text-base-content/70">
              Classify each store by appeal level, fit signals, risk signals,
              data quality, contact readiness, sales stage and recommended next
              action.
            </p>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-base-300 bg-base-100 py-20">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : !store ? (
            <div className="alert alert-error">
              <span>Store not found.</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm md:col-span-2">
                  <div className="text-sm text-base-content/60">Store</div>

                  <div className="mt-1 text-xl font-semibold">{store.name}</div>

                  <div className="mt-1 text-sm text-base-content/70">
                    {store.domain}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {store.isActive ? (
                      <span className="badge badge-success badge-outline">
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-ghost">Inactive</span>
                    )}

                    {selectedAppeal ? (
                      <span
                        className={`badge ${priorityBadge(
                          selectedAppeal.priority
                        )}`}
                      >
                        {selectedAppeal.appealLevel?.label || 'Selected'}
                      </span>
                    ) : (
                      <span className="badge badge-warning">
                        Appeal not selected
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="text-sm text-base-content/60">
                    Preview Score
                  </div>

                  <div className="mt-2 text-3xl font-semibold">
                    {computedPreviewScore || '-'}
                  </div>

                  <div className="mt-1 text-xs text-base-content/60">
                    Calculated from selected fields
                  </div>
                </div>

                <div className="rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm">
                  <div className="text-sm text-base-content/60">
                    Next Follow-up
                  </div>

                  <div className="mt-2 text-sm font-medium">
                    {formatDate(summary?.nextFollowUpAt)}
                  </div>

                  <div className="mt-1 text-xs text-base-content/60">
                    Selected: {formatDate(selectedAppeal?.selectedAt)}
                  </div>
                </div>
              </div>

              <form
                onSubmit={handleSaveAppeal}
                className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Store Appeal Classification
                    </h2>

                    <p className="mt-1 text-sm text-base-content/70">
                      Select structured default items. These become CRM analysis
                      data for this store.
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`btn btn-primary ${
                      isSaving ? 'btn-disabled' : ''
                    }`}
                  >
                    {isSaving ? 'Saving...' : 'Save Classification'}
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-7">
                  {appealLevels.map((level) => {
                    const active = selectedLevelKey === level.key;

                    return (
                      <button
                        key={level.key}
                        type="button"
                        onClick={() => setSelectedLevelKey(level.key)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          active
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20'
                            : 'border-base-300 bg-base-100 hover:border-primary/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{level.label}</div>

                          <span
                            className={`badge ${priorityBadge(
                              level.priority
                            )}`}
                          >
                            {level.score}
                          </span>
                        </div>

                        <div className="mt-2 text-xs uppercase tracking-wide text-base-content/50">
                          {level.priority}
                        </div>

                        <p className="mt-3 text-sm leading-6 text-base-content/70">
                          {level.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                <SelectableCardGrid
                  title="Appeal Modes"
                  description="Select the general modes that describe why this store may matter."
                  items={appealModes}
                  selectedKeys={selectedModeKeys}
                  onToggle={(key) => toggleKey(key, setSelectedModeKeys)}
                  activeClassName="border-secondary bg-secondary/10 ring-2 ring-secondary/20"
                  inactiveHoverClassName="hover:border-secondary/60"
                  rightBadge={(item) =>
                    selectedModeKeys.includes(item.key) ? (
                      <span className="badge badge-secondary">Selected</span>
                    ) : null
                  }
                  columns="lg:grid-cols-4"
                />

                <SelectableCardGrid
                  title="Fit Signals"
                  description="Select positive signals that increase the store’s appeal."
                  items={fitSignals}
                  selectedKeys={selectedFitSignalKeys}
                  onToggle={(key) => toggleKey(key, setSelectedFitSignalKeys)}
                  activeClassName="border-success bg-success/10 ring-2 ring-success/20"
                  inactiveHoverClassName="hover:border-success/60"
                  rightBadge={(item) => (
                    <span className="badge badge-success badge-outline">
                      +{(item as FitSignal).weight}
                    </span>
                  )}
                  columns="lg:grid-cols-5"
                />

                <SelectableCardGrid
                  title="Risk Signals"
                  description="Select negative signals that reduce the store’s appeal."
                  items={riskSignals}
                  selectedKeys={selectedRiskSignalKeys}
                  onToggle={(key) => toggleKey(key, setSelectedRiskSignalKeys)}
                  activeClassName="border-error bg-error/10 ring-2 ring-error/20"
                  inactiveHoverClassName="hover:border-error/60"
                  rightBadge={(item) => (
                    <span
                      className={`badge ${riskBadge(
                        (item as RiskSignal).severity
                      )} badge-outline`}
                    >
                      {(item as RiskSignal).severity}
                    </span>
                  )}
                  columns="lg:grid-cols-5"
                />

                <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Data Quality</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={selectedDataQualityKey}
                      onChange={(event) =>
                        setSelectedDataQualityKey(event.target.value)
                      }
                    >
                      {dataQualityLevels.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    {selectedDataQuality && (
                      <div className="mt-2 text-xs leading-5 text-base-content/60">
                        {selectedDataQuality.description}
                      </div>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Contact Readiness</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={selectedContactReadinessKey}
                      onChange={(event) =>
                        setSelectedContactReadinessKey(event.target.value)
                      }
                    >
                      {contactReadiness.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    {selectedContactReadiness && (
                      <div className="mt-2 text-xs leading-5 text-base-content/60">
                        {selectedContactReadiness.description}
                      </div>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Sales Stage</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={selectedSalesStageKey}
                      onChange={(event) =>
                        setSelectedSalesStageKey(event.target.value)
                      }
                    >
                      {salesStages.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    {selectedSalesStage && (
                      <div className="mt-2 text-xs leading-5 text-base-content/60">
                        {selectedSalesStage.description}
                      </div>
                    )}
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Recommended Action</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={selectedRecommendedActionKey}
                      onChange={(event) =>
                        setSelectedRecommendedActionKey(event.target.value)
                      }
                    >
                      {recommendedActions.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    {selectedRecommendedAction && (
                      <div className="mt-2 text-xs leading-5 text-base-content/60">
                        {selectedRecommendedAction.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
                    <div className="text-sm text-base-content/60">
                      Base Score
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {selectedLevel?.score || '-'}
                    </div>
                    <div className="mt-1 text-xs text-base-content/60">
                      From appeal level
                    </div>
                  </div>

                  <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
                    <div className="text-sm text-base-content/60">
                      Computed Score
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {computedPreviewScore || '-'}
                    </div>
                    <div className="mt-1 text-xs text-base-content/60">
                      Level + fit signals - risk signals + data quality
                    </div>
                  </div>

                  <div className="rounded-2xl border border-base-300 bg-base-200/30 p-5">
                    <div className="text-sm text-base-content/60">
                      Selected Dimensions
                    </div>
                    <div className="mt-2 text-3xl font-semibold">
                      {selectedModeKeys.length +
                        selectedFitSignalKeys.length +
                        selectedRiskSignalKeys.length +
                        4}
                    </div>
                    <div className="mt-1 text-xs text-base-content/60">
                      Number of active structured data points
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <label className="label">
                    <span className="label-text">Optional note</span>
                  </label>

                  <textarea
                    className="textarea textarea-bordered min-h-[120px] w-full"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Optional explanation for this appeal classification..."
                    dir="ltr"
                  />
                </div>
              </form>

              <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">AI CRM Analysis</h2>

                    <p className="mt-1 text-sm text-base-content/70">
                      Analysis will include the selected appeal level, modes,
                      fit signals, risks, data quality, contact readiness, sales
                      stage and recommended next action.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isAnalyzing || Boolean(analysisRunId)}
                    className={`btn btn-primary ${
                      isAnalyzing || analysisRunId ? 'btn-disabled' : ''
                    }`}
                    onClick={handleAnalyzeCrm}
                  >
                    {isAnalyzing || analysisRunId
                      ? 'Running...'
                      : 'Analyze CRM'}
                  </button>
                </div>

                {(isAnalyzing || analysisRunId) && (
                  <div className="mt-5 rounded-xl border border-info/30 bg-info/5 p-4 text-sm text-base-content/70">
                    <div className="flex items-center gap-2">
                      <span className="loading loading-spinner loading-sm" />
                      <span>
                        {analysisRunId
                          ? `CRM analysis is running. Status: ${
                              analysisRunStatus || 'queued'
                            }`
                          : 'Starting CRM analysis...'}
                      </span>
                    </div>

                    {analysisRunId && (
                      <div className="mt-2 break-all font-mono text-xs text-base-content/50">
                        Run ID: {analysisRunId}
                      </div>
                    )}
                  </div>
                )}

                {!latestAnalysis ? (
                  <div className="mt-5 rounded-xl border border-dashed border-base-300 bg-base-200/40 p-5 text-sm text-base-content/70">
                    No CRM analysis saved yet.
                  </div>
                ) : !analysisData ? (
                  <div className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-5 text-sm">
                    Analysis exists, but its structure is not readable by this
                    page.
                  </div>
                ) : (
                  <div className="mt-5 space-y-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Stage
                        </div>
                        <div className="mt-1 font-semibold">
                          {analysisData.crmStatus?.stage || 'unknown'}
                        </div>
                      </div>

                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Priority
                        </div>
                        <div className="mt-1 font-semibold">
                          {analysisData.score?.priority ?? '-'} / 100
                        </div>
                      </div>

                      <div className="rounded-xl bg-base-200/50 p-4">
                        <div className="text-xs text-base-content/60">
                          Generated
                        </div>
                        <div className="mt-1 font-semibold">
                          {formatDate(
                            latestAnalysis.generatedAt ||
                              latestAnalysis.createdAt
                          )}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="font-semibold">Executive Summary</h3>

                      <p className="mt-2 text-sm leading-6 text-base-content/80">
                        {analysisData.summary?.executiveSummary || '-'}
                      </p>
                    </div>

                    {analysisData.recommendation && (
                      <div className="rounded-xl border border-base-300 p-4 text-sm">
                        <h3 className="font-semibold">Recommendation</h3>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                          <div>
                            <span className="text-base-content/60">
                              Next action:
                            </span>{' '}
                            {analysisData.recommendation?.nextAction || '-'}
                          </div>

                          <div>
                            <span className="text-base-content/60">
                              Channel:
                            </span>{' '}
                            {analysisData.recommendation
                              ?.recommendedChannel || '-'}
                          </div>

                          <div>
                            <span className="text-base-content/60">
                              Timing:
                            </span>{' '}
                            {analysisData.recommendation
                              ?.recommendedTiming || '-'}
                          </div>
                        </div>

                        {analysisData.recommendation?.reason && (
                          <p className="mt-3 leading-6 text-base-content/80">
                            {analysisData.recommendation.reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();