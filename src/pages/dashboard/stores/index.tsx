import { DashboardLayout } from '@/components/layouts';
import Pagination, {
  type PaginationMeta,
} from '@/components/common/Pagination';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

type DiscoveryStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed';

type SortOrder = 'asc' | 'desc';

type SortField =
  | 'createdAt'
  | 'updatedAt'
  | 'checkedAt'
  | 'name'
  | 'domain'
  | 'country'
  | 'contactEmail'
  | 'isActive'
  | 'isChecked';

type StoreContactDiscovery = {
  status?: DiscoveryStatus;
  inputDomain?: string;
  requestedUrl?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  maxPages?: number;
  pageCount?: number;
  primaryEmail?: string;
  emails?: {
    value: string;
    sourceUrl?: string;
    kind?: string;
  }[];
  phones?: {
    value: string;
    sourceUrl?: string;
  }[];
  socialProfiles?: {
    platform: string;
    url: string;
    sourceUrl?: string;
  }[];
  contactForms?: {
    url: string;
    action?: string;
    method?: string;
  }[];
  pages?: {
    url: string;
    status?: number | null;
    ok?: boolean;
    reason?: string;
  }[];
  crawlErrors?: {
    url?: string;
    message?: string;
  }[];

  // Legacy compatibility for old saved records.
  errors?: {
    url?: string;
    message?: string;
  }[];

  summary?: {
    emailCount?: number;
    phoneCount?: number;
    socialProfileCount?: number;
    contactFormCount?: number;
    pagesVisited?: number;
    errorCount?: number;

    // Legacy compatibility for old saved records.
    errors?: number;
  };
};

type Store = {
  _id: string;
  name: string;
  domain: string;
  platform: 'shopify';
  country?: string;
  contactName?: string;
  contactEmail?: string;
  notes?: string;
  isActive: boolean;
  isChecked?: boolean;
  checkedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  metadata?: {
    contactDiscovery?: StoreContactDiscovery;
    [key: string]: any;
  };
};

type StoreFormData = {
  name: string;
  domain: string;
  country: string;
  contactName: string;
  contactEmail: string;
  notes: string;
  isActive: boolean;
  isChecked: boolean;
};

type ImportResult = {
  totalRows: number;
  validRows: number;
  insertedCount: number;
  skippedExistingCount: number;
  duplicateInBatchCount: number;
  invalidCount: number;
  invalidRows?: {
    row: number;
    domain?: string;
    reason: string;
  }[];
};

type FetchStoresOptions = {
  query?: string;
  page?: number;
  limit?: number;
  activeFilter?: string;
  checkedFilter?: string;
  countryFilter?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
};

const defaultFormValues: StoreFormData = {
  name: '',
  domain: '',
  country: '',
  contactName: '',
  contactEmail: '',
  notes: '',
  isActive: true,
  isChecked: false,
};

const sortOptions: { value: SortField; label: string }[] = [
  { value: 'createdAt', label: 'Created' },
  { value: 'updatedAt', label: 'Updated' },
  { value: 'checkedAt', label: 'Checked Date' },
  { value: 'name', label: 'Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'country', label: 'Country' },
  { value: 'contactEmail', label: 'Email' },
  { value: 'isActive', label: 'Active' },
  { value: 'isChecked', label: 'Checked' },
];

const getErrorMessage = (error: any, fallback: string) => {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    fallback
  );
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString();
};

const getDiscoveryStatusClass = (status?: DiscoveryStatus) => {
  if (status === 'success') return 'badge-success';
  if (status === 'partial') return 'badge-warning';
  if (status === 'failed') return 'badge-error';
  if (status === 'running') return 'badge-info';
  if (status === 'pending') return 'badge-ghost';

  return 'badge-ghost';
};

const getDiscoveryErrors = (discovery?: StoreContactDiscovery | null) => {
  return discovery?.crawlErrors || discovery?.errors || [];
};

const getDiscoveryErrorCount = (discovery?: StoreContactDiscovery | null) => {
  return (
    discovery?.summary?.errorCount ??
    discovery?.summary?.errors ??
    getDiscoveryErrors(discovery).length
  );
};

const getDiscoveryCounts = (discovery?: StoreContactDiscovery | null) => {
  return {
    emails: discovery?.summary?.emailCount ?? discovery?.emails?.length ?? 0,
    phones: discovery?.summary?.phoneCount ?? discovery?.phones?.length ?? 0,
    socialProfiles:
      discovery?.summary?.socialProfileCount ??
      discovery?.socialProfiles?.length ??
      0,
    contactForms:
      discovery?.summary?.contactFormCount ??
      discovery?.contactForms?.length ??
      0,
    pages:
      discovery?.summary?.pagesVisited ??
      discovery?.pageCount ??
      discovery?.pages?.length ??
      0,
    errors: getDiscoveryErrorCount(discovery),
  };
};

const getSortValue = (store: Store, field: SortField): string | number => {
  if (field === 'createdAt') {
    return store.createdAt ? new Date(store.createdAt).getTime() : 0;
  }

  if (field === 'updatedAt') {
    return store.updatedAt ? new Date(store.updatedAt).getTime() : 0;
  }

  if (field === 'checkedAt') {
    return store.checkedAt ? new Date(store.checkedAt).getTime() : 0;
  }

  if (field === 'isActive') {
    return store.isActive ? 1 : 0;
  }

  if (field === 'isChecked') {
    return store.isChecked ? 1 : 0;
  }

  return String(store[field] || '').toLowerCase();
};

const StoresPage = () => {
  const createModalRef = useRef<HTMLDialogElement | null>(null);
  const editModalRef = useRef<HTMLDialogElement | null>(null);
  const detailsModalRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const [isListLoading, setIsListLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState('');

  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [checkedFilter, setCheckedFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [deletingId, setDeletingId] = useState('');
  const [checkingId, setCheckingId] = useState('');
  const [discoveringId, setDiscoveringId] = useState('');
  const [isBulkChecking, setIsBulkChecking] = useState(false);

  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [detailsStore, setDetailsStore] = useState<Store | null>(null);

  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const createForm = useForm<StoreFormData>({
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<StoreFormData>({
    defaultValues: defaultFormValues,
  });

  const sortedStores = useMemo(() => {
    return [...stores].sort((a, b) => {
      const aValue = getSortValue(a, sortBy);
      const bValue = getSortValue(b, sortBy);

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;

      return String(a.domain || '').localeCompare(String(b.domain || ''));
    });
  }, [stores, sortBy, sortOrder]);

  const selectedStoreIdSet = useMemo(() => {
    return new Set(selectedStoreIds);
  }, [selectedStoreIds]);

  const visibleStoreIds = useMemo(() => {
    return sortedStores.map((store) => store._id);
  }, [sortedStores]);

  const allVisibleSelected =
    visibleStoreIds.length > 0 &&
    visibleStoreIds.every((storeId) => selectedStoreIdSet.has(storeId));

  const selectedStores = useMemo(() => {
    return stores.filter((store) => selectedStoreIdSet.has(store._id));
  }, [stores, selectedStoreIdSet]);

  const dashboardStats = useMemo(() => {
    const total = pagination?.total ?? stores.length;
    const checked = stores.filter((store) => store.isChecked).length;
    const active = stores.filter((store) => store.isActive).length;
    const withEmail = stores.filter((store) => store.contactEmail).length;
    const withDiscovery = stores.filter(
      (store) => store.metadata?.contactDiscovery
    ).length;

    return {
      total,
      active,
      checked,
      withEmail,
      withDiscovery,
    };
  }, [pagination?.total, stores]);

  const detailsDiscovery = detailsStore?.metadata?.contactDiscovery || null;
  const detailsCounts = getDiscoveryCounts(detailsDiscovery);
  const detailsErrors = getDiscoveryErrors(detailsDiscovery);

  const fetchStores = async (options: FetchStoresOptions = {}) => {
    const nextSearch = options.query ?? search;
    const nextPage = options.page ?? page;
    const nextLimit = options.limit ?? limit;
    const nextActiveFilter = options.activeFilter ?? activeFilter;
    const nextCheckedFilter = options.checkedFilter ?? checkedFilter;
    const nextCountryFilter = options.countryFilter ?? countryFilter;
    const nextSortBy = options.sortBy ?? sortBy;
    const nextSortOrder = options.sortOrder ?? sortOrder;

    try {
      setListError('');

      const response = await api.get('/stores', {
        params: {
          page: nextPage,
          limit: nextLimit,
          ...(nextSearch ? { q: nextSearch } : {}),
          ...(nextActiveFilter !== ''
            ? { isActive: nextActiveFilter === 'true' }
            : {}),
          ...(nextCheckedFilter !== ''
            ? { isChecked: nextCheckedFilter === 'true' }
            : {}),
          ...(nextCountryFilter ? { country: nextCountryFilter } : {}),
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
        },
      });

      setStores(response?.data?.data?.stores || []);
      setPagination(response?.data?.data?.pagination || null);
    } catch (error: any) {
      setListError(getErrorMessage(error, 'Failed to load stores.'));
    } finally {
      setIsListLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStores({
      query: '',
      page: 1,
      limit,
      activeFilter: '',
      checkedFilter: '',
      countryFilter: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSortChange = async (field: SortField) => {
    const nextOrder: SortOrder =
      sortBy === field && sortOrder === 'desc' ? 'asc' : 'desc';

    setSortBy(field);
    setSortOrder(nextOrder);
    setPage(1);
    setIsRefreshing(true);

    await fetchStores({
      page: 1,
      limit,
      sortBy: field,
      sortOrder: nextOrder,
    });
  };

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return <span className="opacity-30">↕</span>;

    return <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  const openCreateModal = () => {
    createForm.reset(defaultFormValues);
    createModalRef.current?.showModal();
  };

  const closeCreateModal = () => {
    createModalRef.current?.close();
  };

  const openEditModal = (store: Store) => {
    setEditingStore(store);

    editForm.reset({
      name: store.name || '',
      domain: store.domain || '',
      country: store.country || '',
      contactName: store.contactName || '',
      contactEmail: store.contactEmail || '',
      notes: store.notes || '',
      isActive: Boolean(store.isActive),
      isChecked: Boolean(store.isChecked),
    });

    editModalRef.current?.showModal();
  };

  const closeEditModal = () => {
    editModalRef.current?.close();
    setEditingStore(null);
  };

  const openDetailsModal = (store: Store) => {
    setDetailsStore(store);
    detailsModalRef.current?.showModal();
  };

  const closeDetailsModal = () => {
    detailsModalRef.current?.close();
    setDetailsStore(null);
  };

  const toggleSelectStore = (storeId: string) => {
    setSelectedStoreIds((prev) => {
      if (prev.includes(storeId)) {
        return prev.filter((id) => id !== storeId);
      }

      return [...prev, storeId];
    });
  };

  const toggleSelectVisibleStores = () => {
    setSelectedStoreIds((prev) => {
      const current = new Set(prev);

      if (allVisibleSelected) {
        visibleStoreIds.forEach((id) => current.delete(id));
      } else {
        visibleStoreIds.forEach((id) => current.add(id));
      }

      return [...current];
    });
  };

  const clearSelectedStores = () => {
    setSelectedStoreIds([]);
  };

  const onCreateSubmit = async (data: StoreFormData) => {
    try {
      const response = await api.post('/stores', {
        name: data.name,
        domain: data.domain,
        country: data.country,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        notes: data.notes,
        isActive: data.isActive,
        isChecked: data.isChecked,
      });

      toast.success(response?.data?.message || 'Store created successfully.');

      setPage(1);
      await fetchStores({ page: 1 });

      closeCreateModal();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to create store.'));
    }
  };

  const onEditSubmit = async (data: StoreFormData) => {
    if (!editingStore?._id) return;

    try {
      const response = await api.patch(`/stores/${editingStore._id}`, {
        name: data.name,
        domain: data.domain,
        country: data.country,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        notes: data.notes,
        isActive: data.isActive,
        isChecked: data.isChecked,
      });

      toast.success(response?.data?.message || 'Store updated successfully.');

      await fetchStores({ page, limit });

      closeEditModal();
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update store.'));
    }
  };

  const performDeleteStore = async (store: Store) => {
    try {
      setDeletingId(store._id);
      setListError('');

      const response = await api.delete(`/stores/${store._id}`);

      toast.success(response?.data?.message || 'Store deleted successfully.');

      const shouldGoBackOnePage = stores.length === 1 && page > 1;
      const nextPage = shouldGoBackOnePage ? page - 1 : page;

      setPage(nextPage);
      setSelectedStoreIds((prev) => prev.filter((id) => id !== store._id));

      await fetchStores({ page: nextPage, limit });
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to delete store.'));
    } finally {
      setDeletingId('');
    }
  };

  const handleDeleteStore = (store: Store) => {
    toast(`Delete "${store.name}"?`, {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: () => {
          performDeleteStore(store);
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const toggleStoreChecked = async (store: Store) => {
    try {
      setCheckingId(store._id);

      const nextChecked = !store.isChecked;

      await api.patch(`/stores/${store._id}`, {
        isChecked: nextChecked,
      });

      toast.success(
        nextChecked ? 'Store marked as checked.' : 'Store unchecked.'
      );

      await fetchStores({ page, limit });
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to update checked status.'));
    } finally {
      setCheckingId('');
    }
  };

  const handleDiscoverStoreContacts = async (store: Store) => {
    const toastId = toast.loading(
      `Discovering contact points for ${store.domain}...`
    );

    try {
      setDiscoveringId(store._id);

      const response = await api.post(`/stores/${store._id}/discover-contacts`, {
        maxPages: 30,
        appendNotes: true,
      });

      toast.dismiss(toastId);

      const updatedStore = response?.data?.data?.store;

      if (updatedStore?._id) {
        setStores((prev) =>
          prev.map((item) =>
            item._id === updatedStore._id ? updatedStore : item
          )
        );

        if (detailsStore?._id === updatedStore._id) {
          setDetailsStore(updatedStore);
        }
      } else {
        await fetchStores({ page, limit });
      }

      toast.success(response?.data?.message || 'Contact discovery completed.');
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(getErrorMessage(error, 'Failed to discover contact points.'));
    } finally {
      setDiscoveringId('');
    }
  };

  const performBulkDiscoverSelectedStores = async () => {
    const toastId = toast.loading(
      `Checking ${selectedStoreIds.length} selected stores...`
    );

    try {
      setIsBulkChecking(true);

      const response = await api.post('/stores/discover-contacts/bulk', {
        storeIds: selectedStoreIds,
        maxPages: 30,
        maxBatchSize: 50,
        concurrency: 3,
        appendNotes: true,
      });

      toast.dismiss(toastId);

      const results = response?.data?.data?.results || [];

      const updatedStores = results
        .filter((item: any) => item?.store?._id)
        .map((item: any) => item.store as Store);

      if (updatedStores.length) {
        setStores((prev) =>
          prev.map((store) => {
            const updated = updatedStores.find(
              (item : any) => item._id === store._id
            );

            return updated || store;
          })
        );

        if (detailsStore?._id) {
          const updatedDetailsStore = updatedStores.find(
            (item : any) => item._id === detailsStore._id
          );

          if (updatedDetailsStore) {
            setDetailsStore(updatedDetailsStore);
          }
        }
      }

      const successCount = response?.data?.data?.successCount || 0;
      const failedCount = response?.data?.data?.failedCount || 0;

      if (failedCount > 0) {
        toast.warning(
          `Bulk check finished: ${successCount} success, ${failedCount} failed.`
        );
      } else {
        toast.success(
          response?.data?.message ||
            `Bulk check completed for ${successCount} stores.`
        );
      }

      setSelectedStoreIds([]);
      await fetchStores({ page, limit });
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error(getErrorMessage(error, 'Bulk contact discovery failed.'));
    } finally {
      setIsBulkChecking(false);
    }
  };

  const handleBulkDiscoverSelectedStores = async () => {
    if (!selectedStoreIds.length) {
      toast.error('Select at least one store first.');
      return;
    }

    toast(`Start contact discovery for ${selectedStoreIds.length} stores?`, {
      description:
        'Selected stores will be crawled and updated with discovered contact data.',
      action: {
        label: 'Start',
        onClick: () => {
          performBulkDiscoverSelectedStores();
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  const handleApplyFilters = async (e: FormEvent) => {
    e.preventDefault();

    setPage(1);
    setIsRefreshing(true);
    setSelectedStoreIds([]);

    await fetchStores({ page: 1, limit });
  };

  const handleResetFilters = async () => {
    setSearch('');
    setActiveFilter('');
    setCheckedFilter('');
    setCountryFilter('');
    setSortBy('createdAt');
    setSortOrder('desc');
    setPage(1);
    setIsRefreshing(true);
    setSelectedStoreIds([]);

    await fetchStores({
      query: '',
      page: 1,
      limit,
      activeFilter: '',
      checkedFilter: '',
      countryFilter: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });
  };

  const handlePageChange = async (nextPage: number) => {
    setPage(nextPage);
    setIsRefreshing(true);
    setSelectedStoreIds([]);

    await fetchStores({ page: nextPage, limit });
  };

  const handleLimitChange = async (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);
    setIsRefreshing(true);
    setSelectedStoreIds([]);

    await fetchStores({
      page: 1,
      limit: nextLimit,
    });
  };

  const performImportFromJson = async () => {
    if (!jsonFile) {
      toast.error('Please select a JSON file first.');
      return;
    }

    if (!jsonFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Only .json files are allowed.');
      return;
    }

    try {
      setIsImporting(true);
      setUploadProgress(null);
      setImportResult(null);

      const formData = new FormData();
      formData.append('file', jsonFile);

      const response = await api.post('/stores/import-json', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (event: any) => {
          if (!event.total) return;

          const percent = Math.round((event.loaded * 100) / event.total);
          setUploadProgress(percent);
        },
      });

      const result = response?.data?.data || null;

      setImportResult(result);

      toast.success(response?.data?.message || 'Stores imported successfully.');

      setJsonFile(null);
      setPage(1);
      setSelectedStoreIds([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchStores({ page: 1, limit });
    } catch (error: any) {
      toast.error(getErrorMessage(error, 'Failed to import stores from JSON.'));
    } finally {
      setIsImporting(false);
      setUploadProgress(null);
    }
  };

  const handleImportFromJson = async () => {
    if (!jsonFile) {
      toast.error('Please select a JSON file first.');
      return;
    }

    if (!jsonFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Only .json files are allowed.');
      return;
    }

    toast('Import stores from JSON?', {
      description:
        'Existing stores will not be removed. Duplicate domains will be skipped.',
      action: {
        label: 'Import',
        onClick: () => {
          performImportFromJson();
        },
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
      duration: 10000,
    });
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-base-200/40 py-8" dir="ltr">
        <div className="mx-auto max-w-[1700px] space-y-6 px-4 md:px-6">
          <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 p-5 md:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-bold text-base-content md:text-3xl">
                      Stores
                    </h1>

                    <span className="badge badge-primary badge-outline">
                      Shopify
                    </span>

                    <span className="badge badge-ghost">
                      Sorted by {sortOptions.find((item) => item.value === sortBy)?.label}{' '}
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  </div>

                  <p className="mt-2 max-w-3xl text-sm text-base-content/70">
                    Manage imported Shopify stores, batch contact checking, CRM
                    workflow state, and outreach handoff from one operational
                    table.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    title="Create a new store"
                    className="btn btn-primary"
                    onClick={openCreateModal}
                  >
                    + Create Store
                  </button>

                  <button
                    type="button"
                    title="Refresh store list"
                    className={`btn btn-outline ${
                      isRefreshing ? 'btn-disabled' : ''
                    }`}
                    onClick={() => {
                      setIsRefreshing(true);
                      fetchStores({ page, limit });
                    }}
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
                <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-base-content/50">
                    Total
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {dashboardStats.total}
                  </div>
                </div>

                <div className="rounded-2xl border border-success/20 bg-success/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-success">
                    Active
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {dashboardStats.active}
                  </div>
                </div>

                <div className="rounded-2xl border border-info/20 bg-info/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-info">
                    Checked
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {dashboardStats.checked}
                  </div>
                </div>

                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-primary">
                    With Email
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {dashboardStats.withEmail}
                  </div>
                </div>

                <div className="rounded-2xl border border-secondary/20 bg-secondary/5 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-secondary">
                    Discovered
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {dashboardStats.withDiscovery}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-5 md:p-7">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
                <div className="rounded-3xl border border-base-300 bg-base-100 p-5 shadow-sm">
                  <form
                    onSubmit={handleApplyFilters}
                    className="grid grid-cols-1 gap-4 lg:grid-cols-12"
                  >
                    <div className="form-control lg:col-span-4">
                      <label className="label" htmlFor="store-search">
                        <span className="label-text">Search</span>
                      </label>

                      <input
                        id="store-search"
                        type="text"
                        title="Search stores by name, domain, country, or email"
                        className="input input-bordered w-full bg-base-100"
                        value={search}
                        placeholder="Search name, domain, country, email"
                        dir="ltr"
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setSearch(e.target.value)
                        }
                      />
                    </div>

                    <div className="form-control lg:col-span-2">
                      <label className="label" htmlFor="active-filter">
                        <span className="label-text">Active Status</span>
                      </label>

                      <select
                        id="active-filter"
                        title="Filter stores by active status"
                        className="select select-bordered bg-base-100"
                        value={activeFilter}
                        onChange={(e) => setActiveFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        <option value="true">Active</option>
                        <option value="false">Inactive</option>
                      </select>
                    </div>

                    <div className="form-control lg:col-span-2">
                      <label className="label" htmlFor="checked-filter">
                        <span className="label-text">Review Status</span>
                      </label>

                      <select
                        id="checked-filter"
                        title="Filter stores by checked or reviewed status"
                        className="select select-bordered bg-base-100"
                        value={checkedFilter}
                        onChange={(e) => setCheckedFilter(e.target.value)}
                      >
                        <option value="">All</option>
                        <option value="true">Checked</option>
                        <option value="false">Not checked</option>
                      </select>
                    </div>

                    <div className="form-control lg:col-span-2">
                      <label className="label" htmlFor="country-filter">
                        <span className="label-text">Country</span>
                      </label>

                      <input
                        id="country-filter"
                        type="text"
                        title="Filter stores by country"
                        className="input input-bordered w-full bg-base-100"
                        value={countryFilter}
                        placeholder="Canada"
                        dir="ltr"
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          setCountryFilter(e.target.value)
                        }
                      />
                    </div>

                    <div className="form-control lg:col-span-1">
                      <label className="label" htmlFor="sort-by">
                        <span className="label-text">Sort Field</span>
                      </label>

                      <select
                        id="sort-by"
                        title="Select the field used for sorting"
                        className="select select-bordered bg-base-100"
                        value={sortBy}
                        onChange={(e) =>
                          handleSortChange(e.target.value as SortField)
                        }
                      >
                        {sortOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control lg:col-span-1">
                      <label className="label" htmlFor="sort-order">
                        <span className="label-text">Order</span>
                      </label>

                      <select
                        id="sort-order"
                        title="Select ascending or descending sort order"
                        className="select select-bordered bg-base-100"
                        value={sortOrder}
                        onChange={(e) => {
                          const nextOrder = e.target.value as SortOrder;

                          setSortOrder(nextOrder);
                          setPage(1);
                          setIsRefreshing(true);

                          fetchStores({
                            page: 1,
                            limit,
                            sortBy,
                            sortOrder: nextOrder,
                          });
                        }}
                      >
                        <option value="desc">Desc</option>
                        <option value="asc">Asc</option>
                      </select>
                    </div>

                    <div className="flex flex-wrap items-end gap-2 lg:col-span-12">
                      <button
                        type="submit"
                        title="Apply store filters"
                        className={`btn btn-primary ${
                          isRefreshing ? 'btn-disabled' : ''
                        }`}
                      >
                        {isRefreshing ? (
                          <>
                            <span className="loading loading-spinner loading-sm" />
                            Filtering
                          </>
                        ) : (
                          'Apply Filters'
                        )}
                      </button>

                      <button
                        type="button"
                        title="Reset all filters"
                        className="btn btn-ghost"
                        onClick={handleResetFilters}
                      >
                        Reset
                      </button>
                    </div>
                  </form>
                </div>

                <div className="rounded-3xl border border-info/20 bg-info/5 p-5 shadow-sm">
                  <div className="flex flex-col gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-base-content">
                        Import Stores
                      </h2>

                      <p className="mt-1 text-sm text-base-content/70">
                        Upload a JSON array. Existing domains are skipped.
                      </p>
                    </div>

                    <div className="form-control">
                      <label className="label" htmlFor="stores-json-file">
                        <span className="label-text">JSON File</span>
                      </label>

                      <input
                        id="stores-json-file"
                        ref={fileInputRef}
                        type="file"
                        title="Select stores JSON file"
                        accept="application/json,.json"
                        className="file-input file-input-bordered w-full bg-base-100"
                        disabled={isImporting}
                        onChange={(e) => {
                          setJsonFile(e.target.files?.[0] || null);
                          setImportResult(null);
                          setUploadProgress(null);
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      title="Import stores from selected JSON file"
                      className={`btn btn-info ${
                        isImporting ? 'btn-disabled' : ''
                      }`}
                      onClick={handleImportFromJson}
                    >
                      {isImporting ? (
                        <>
                          <span className="loading loading-spinner loading-sm" />
                          Importing
                        </>
                      ) : (
                        'Import JSON'
                      )}
                    </button>

                    {jsonFile && (
                      <div className="text-sm text-base-content/70">
                        Selected:{' '}
                        <span className="font-medium text-base-content">
                          {jsonFile.name}
                        </span>
                      </div>
                    )}

                    {uploadProgress !== null && (
                      <div>
                        <div className="mb-1 flex justify-between text-xs text-base-content/70">
                          <span>Uploading</span>
                          <span>{uploadProgress}%</span>
                        </div>

                        <progress
                          className="progress progress-info w-full"
                          value={uploadProgress}
                          max={100}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {importResult && (
                <div className="rounded-3xl border border-base-300 bg-base-100 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold">Import Result</h3>

                    <button
                      type="button"
                      title="Hide import result"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setImportResult(null)}
                    >
                      Dismiss
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                    <div className="rounded-2xl bg-base-200/70 p-4">
                      <div className="text-xs text-base-content/60">
                        Total Rows
                      </div>
                      <div className="mt-1 text-xl font-bold">
                        {importResult.totalRows}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-base-200/70 p-4">
                      <div className="text-xs text-base-content/60">
                        Valid Rows
                      </div>
                      <div className="mt-1 text-xl font-bold">
                        {importResult.validRows}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-success/10 p-4">
                      <div className="text-xs text-success">Inserted</div>
                      <div className="mt-1 text-xl font-bold text-success">
                        {importResult.insertedCount}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-base-200/70 p-4">
                      <div className="text-xs text-base-content/60">
                        Existing
                      </div>
                      <div className="mt-1 text-xl font-bold">
                        {importResult.skippedExistingCount}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-warning/10 p-4">
                      <div className="text-xs text-warning">
                        Duplicate In File
                      </div>
                      <div className="mt-1 text-xl font-bold text-warning">
                        {importResult.duplicateInBatchCount}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-error/10 p-4">
                      <div className="text-xs text-error">Invalid</div>
                      <div className="mt-1 text-xl font-bold text-error">
                        {importResult.invalidCount}
                      </div>
                    </div>
                  </div>

                  {importResult.invalidRows?.length ? (
                    <div className="mt-5 max-h-[260px] overflow-auto rounded-2xl border border-base-300 bg-base-100">
                      <table className="table table-sm table-pin-rows">
                        <thead>
                          <tr>
                            <th>Row</th>
                            <th>Domain</th>
                            <th>Reason</th>
                          </tr>
                        </thead>

                        <tbody>
                          {importResult.invalidRows.map((row, index) => (
                            <tr key={`${row.row}-${index}`}>
                              <td>{row.row}</td>
                              <td>{row.domain || '-'}</td>
                              <td>{row.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="rounded-3xl border border-base-300 bg-base-100 p-4 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-semibold text-base-content">
                      Bulk Contact Check
                    </div>

                    <div className="mt-1 text-sm text-base-content/60">
                      Selected stores: {selectedStoreIds.length}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      title="Select or unselect all visible stores"
                      className="btn btn-outline btn-sm"
                      onClick={toggleSelectVisibleStores}
                      disabled={isBulkChecking || sortedStores.length === 0}
                    >
                      {allVisibleSelected ? 'Unselect Visible' : 'Select Visible'}
                    </button>

                    <button
                      type="button"
                      title="Clear selected stores"
                      className="btn btn-ghost btn-sm"
                      onClick={clearSelectedStores}
                      disabled={isBulkChecking || selectedStoreIds.length === 0}
                    >
                      Clear
                    </button>

                    <button
                      type="button"
                      title="Start checking selected stores"
                      className={`btn btn-secondary btn-sm ${
                        isBulkChecking || selectedStoreIds.length === 0
                          ? 'btn-disabled'
                          : ''
                      }`}
                      onClick={handleBulkDiscoverSelectedStores}
                    >
                      {isBulkChecking ? (
                        <>
                          <span className="loading loading-spinner loading-xs" />
                          Checking...
                        </>
                      ) : (
                        `Start Checking ${
                          selectedStoreIds.length ? selectedStoreIds.length : ''
                        }`
                      )}
                    </button>
                  </div>
                </div>

                {selectedStores.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedStores.slice(0, 10).map((store) => (
                      <span key={store._id} className="badge badge-outline">
                        {store.domain}
                      </span>
                    ))}

                    {selectedStores.length > 10 && (
                      <span className="badge badge-ghost">
                        +{selectedStores.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>

              {listError && (
                <div className="alert alert-error">
                  <span>{listError}</span>
                </div>
              )}

              <div className="rounded-3xl border border-base-300 bg-base-100 shadow-sm">
                <div className="flex flex-col gap-3 border-b border-base-300 p-5 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Store List</h2>
                    <p className="mt-1 text-sm text-base-content/60">
                      Click table headers to sort. Select rows, then start a
                      batch contact check.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="badge badge-outline">
                      Page {pagination?.page || page}
                    </span>
                    <span className="badge badge-outline">
                      Limit {pagination?.limit || limit}
                    </span>
                    <span className="badge badge-outline">
                      Total {pagination?.total ?? stores.length}
                    </span>
                  </div>
                </div>

                {isListLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <span className="loading loading-spinner loading-lg" />
                  </div>
                ) : sortedStores.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto max-w-md">
                      <div className="text-4xl">🗂️</div>
                      <h3 className="mt-3 text-lg font-semibold">
                        No stores found
                      </h3>
                      <p className="mt-2 text-sm text-base-content/60">
                        Create a store, import JSON, or reset filters.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[720px] overflow-auto">
                      <table className="table table-zebra table-pin-rows min-w-[1540px]">
                        <thead>
                          <tr className="bg-base-200">
                            <th className="w-[170px]">
                              <label className="label cursor-pointer justify-start gap-2 p-0">
                                <input
                                  type="checkbox"
                                  title="Select all visible stores"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={allVisibleSelected}
                                  disabled={
                                    isBulkChecking || sortedStores.length === 0
                                  }
                                  onChange={toggleSelectVisibleStores}
                                />
                                <span>Select</span>
                              </label>
                            </th>

                            <th className="w-[240px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('name')}
                              >
                                Store {renderSortIcon('name')}
                              </button>
                            </th>

                            <th className="w-[240px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('domain')}
                              >
                                Domain {renderSortIcon('domain')}
                              </button>
                            </th>

                            <th className="w-[120px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('country')}
                              >
                                Country {renderSortIcon('country')}
                              </button>
                            </th>

                            <th className="w-[210px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('contactEmail')}
                              >
                                Contact {renderSortIcon('contactEmail')}
                              </button>
                            </th>

                            <th className="w-[250px]">Reach Channels</th>

                            <th className="w-[130px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('isActive')}
                              >
                                Status {renderSortIcon('isActive')}
                              </button>
                            </th>

                            <th className="w-[170px]">
                              <button
                                type="button"
                                className="flex items-center gap-2 font-semibold"
                                onClick={() => handleSortChange('isChecked')}
                              >
                                Review {renderSortIcon('isChecked')}
                              </button>
                            </th>

                            <th className="w-[470px] text-right">Actions</th>
                          </tr>
                        </thead>

                        <tbody>
                          {sortedStores.map((store) => {
                            const discovery =
                              store.metadata?.contactDiscovery || null;
                            const counts = getDiscoveryCounts(discovery);
                            const hasDiscovery = Boolean(discovery);
                            const isSelected = selectedStoreIdSet.has(store._id);

                            return (
                              <tr key={store._id} className="align-top">
                                <td>
                                  <label className="label cursor-pointer justify-start gap-2 p-0">
                                    <input
                                      type="checkbox"
                                      title={`Select ${store.name} for bulk checking`}
                                      className="checkbox checkbox-primary checkbox-sm"
                                      checked={isSelected}
                                      disabled={isBulkChecking}
                                      onChange={() => toggleSelectStore(store._id)}
                                    />

                                    {isSelected ? (
                                      <span className="badge badge-primary badge-outline">
                                        Selected
                                      </span>
                                    ) : store.isChecked ? (
                                      <span className="badge badge-info badge-outline">
                                        Checked
                                      </span>
                                    ) : (
                                      <span className="badge badge-ghost">
                                        Pending
                                      </span>
                                    )}
                                  </label>

                                  <div className="mt-2 text-xs text-base-content/50">
                                    {store.checkedAt
                                      ? formatDateTime(store.checkedAt)
                                      : 'Not reviewed'}
                                  </div>
                                </td>

                                <td>
                                  <div className="font-semibold text-base-content">
                                    {store.name}
                                  </div>

                                  <div className="mt-1 text-xs text-base-content/50">
                                    ID: {store._id.slice(-8)}
                                  </div>
                                </td>

                                <td>
                                  <a
                                    href={`https://${store.domain}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="link-hover link font-medium"
                                  >
                                    {store.domain}
                                  </a>

                                  <div className="mt-1 text-xs text-base-content/50">
                                    {store.platform}
                                  </div>
                                </td>

                                <td>{store.country || '-'}</td>

                                <td>
                                  <div className="space-y-1">
                                    <div className="text-sm">
                                      {store.contactName || '-'}
                                    </div>

                                    {store.contactEmail ? (
                                      <a
                                        href={`mailto:${store.contactEmail}`}
                                        className="link-hover link break-all text-sm"
                                      >
                                        {store.contactEmail}
                                      </a>
                                    ) : (
                                      <div className="text-sm text-base-content/50">
                                        No email
                                      </div>
                                    )}
                                  </div>
                                </td>

                                <td>
                                  {hasDiscovery ? (
                                    <div className="flex flex-wrap gap-1">
                                      {counts.emails > 0 && (
                                        <span className="badge badge-primary badge-outline">
                                          Email {counts.emails}
                                        </span>
                                      )}

                                      {counts.socialProfiles > 0 && (
                                        <span className="badge badge-info badge-outline">
                                          Social {counts.socialProfiles}
                                        </span>
                                      )}

                                      {counts.phones > 0 && (
                                        <span className="badge badge-warning badge-outline">
                                          Phone {counts.phones}
                                        </span>
                                      )}

                                      {counts.contactForms > 0 && (
                                        <span className="badge badge-success badge-outline">
                                          Form {counts.contactForms}
                                        </span>
                                      )}

                                      {counts.emails === 0 &&
                                        counts.socialProfiles === 0 &&
                                        counts.phones === 0 &&
                                        counts.contactForms === 0 && (
                                          <span className="badge badge-ghost">
                                            No channels
                                          </span>
                                        )}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-base-content/50">
                                      Not discovered
                                    </span>
                                  )}
                                </td>

                                <td>
                                  {store.isActive ? (
                                    <span className="badge badge-success badge-outline">
                                      Active
                                    </span>
                                  ) : (
                                    <span className="badge badge-ghost">
                                      Inactive
                                    </span>
                                  )}
                                </td>

                                <td>
                                  {discovery?.status ? (
                                    <div className="space-y-1">
                                      <span
                                        className={`badge badge-outline ${getDiscoveryStatusClass(
                                          discovery.status
                                        )}`}
                                      >
                                        {discovery.status}
                                      </span>

                                      <div className="text-xs text-base-content/50">
                                        Pages: {counts.pages}
                                      </div>

                                      {counts.errors > 0 && (
                                        <div className="text-xs text-error">
                                          Errors: {counts.errors}
                                        </div>
                                      )}
                                    </div>
                                  ) : store.isChecked ? (
                                    <span className="badge badge-info badge-outline">
                                      checked
                                    </span>
                                  ) : (
                                    <span className="badge badge-ghost">
                                      none
                                    </span>
                                  )}
                                </td>

                                <td className="text-right">
                                  <div className="flex flex-wrap justify-end gap-2">
                                    <button
                                      type="button"
                                      title={`Show details for ${store.name}`}
                                      className="btn btn-sm btn-ghost"
                                      onClick={() => openDetailsModal(store)}
                                    >
                                      Details
                                    </button>

                                    <button
                                      type="button"
                                      title={`Find contact points for ${store.domain}`}
                                      className={`btn btn-sm btn-secondary btn-outline ${
                                        discoveringId === store._id ||
                                        isBulkChecking
                                          ? 'btn-disabled'
                                          : ''
                                      }`}
                                      onClick={() =>
                                        handleDiscoverStoreContacts(store)
                                      }
                                    >
                                      {discoveringId === store._id ? (
                                        <>
                                          <span className="loading loading-spinner loading-xs" />
                                          Finding
                                        </>
                                      ) : (
                                        'Find Contacts'
                                      )}
                                    </button>

                                    <button
                                      type="button"
                                      title={`Toggle reviewed status for ${store.name}`}
                                      className="btn btn-sm btn-warning btn-outline"
                                      disabled={
                                        checkingId === store._id ||
                                        isBulkChecking
                                      }
                                      onClick={() => toggleStoreChecked(store)}
                                    >
                                      {store.isChecked ? 'Uncheck' : 'Mark Checked'}
                                    </button>

                                    <Link
                                      title={`Open outreach for ${store.name}`}
                                      href={{
                                        pathname: '/dashboard/outreach',
                                        query: { storeId: store._id },
                                      }}
                                      className="btn btn-sm btn-success btn-outline"
                                    >
                                      Outreach
                                    </Link>

                                    <Link
                                      title={`Open CRM for ${store.name}`}
                                      href={`/dashboard/stores/${store._id}/crm`}
                                      className="btn btn-sm btn-info btn-outline"
                                    >
                                      CRM
                                    </Link>

                                    <button
                                      type="button"
                                      title={`Edit ${store.name}`}
                                      className="btn btn-sm btn-outline"
                                      onClick={() => openEditModal(store)}
                                    >
                                      Edit
                                    </button>

                                    <button
                                      type="button"
                                      title={`Delete ${store.name}`}
                                      className={`btn btn-sm btn-error btn-outline ${
                                        deletingId === store._id
                                          ? 'btn-disabled'
                                          : ''
                                      }`}
                                      onClick={() => handleDeleteStore(store)}
                                    >
                                      {deletingId === store._id
                                        ? 'Deleting'
                                        : 'Delete'}
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t border-base-300">
                      <Pagination
                        pagination={pagination}
                        isLoading={isRefreshing || isListLoading}
                        onPageChange={handlePageChange}
                        onLimitChange={handleLimitChange}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Create Modal */}
        <dialog ref={createModalRef} className="modal">
          <div className="modal-box max-w-3xl rounded-3xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-base-content">
                  Create Store
                </h3>

                <p className="mt-1 text-sm text-base-content/70">
                  Platform is fixed as Shopify.
                </p>
              </div>

              <button
                type="button"
                title="Close create store modal"
                className="btn btn-sm btn-circle btn-ghost"
                onClick={closeCreateModal}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={createForm.handleSubmit(onCreateSubmit)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="form-control">
                  <label className="label" htmlFor="create-store-name">
                    <span className="label-text">Store Name</span>
                  </label>

                  <input
                    id="create-store-name"
                    {...createForm.register('name', {
                      required: 'Store name is required',
                      minLength: {
                        value: 2,
                        message: 'Store name must be at least 2 characters',
                      },
                    })}
                    type="text"
                    title="Store name"
                    className="input input-bordered w-full"
                    placeholder="Gymshark"
                    dir="ltr"
                    autoFocus
                  />

                  {createForm.formState.errors.name?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {createForm.formState.errors.name.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="create-store-domain">
                    <span className="label-text">Domain</span>
                  </label>

                  <input
                    id="create-store-domain"
                    {...createForm.register('domain', {
                      required: 'Domain is required',
                    })}
                    type="text"
                    title="Store domain"
                    className="input input-bordered w-full"
                    placeholder="gymshark.com"
                    dir="ltr"
                  />

                  {createForm.formState.errors.domain?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {createForm.formState.errors.domain.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="create-store-country">
                    <span className="label-text">Country</span>
                  </label>

                  <input
                    id="create-store-country"
                    {...createForm.register('country')}
                    type="text"
                    title="Store country"
                    className="input input-bordered w-full"
                    placeholder="UK"
                    dir="ltr"
                  />
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="create-contact-name">
                    <span className="label-text">Contact Name</span>
                  </label>

                  <input
                    id="create-contact-name"
                    {...createForm.register('contactName')}
                    type="text"
                    title="Contact person name"
                    className="input input-bordered w-full"
                    placeholder="John Doe"
                    dir="ltr"
                  />
                </div>

                <div className="form-control md:col-span-2">
                  <label className="label" htmlFor="create-contact-email">
                    <span className="label-text">Contact Email</span>
                  </label>

                  <input
                    id="create-contact-email"
                    {...createForm.register('contactEmail', {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Enter a valid email address',
                      },
                    })}
                    type="email"
                    title="Contact email address"
                    className="input input-bordered w-full"
                    placeholder="team@gymshark.com"
                    dir="ltr"
                  />

                  {createForm.formState.errors.contactEmail?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {createForm.formState.errors.contactEmail.message}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label" htmlFor="create-store-notes">
                  <span className="label-text">Notes</span>
                </label>

                <textarea
                  id="create-store-notes"
                  {...createForm.register('notes')}
                  title="Internal notes for this store"
                  className="textarea textarea-bordered min-h-[130px] w-full"
                  placeholder="Internal notes about this store"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <input
                    {...createForm.register('isActive')}
                    type="checkbox"
                    title="Set store as active"
                    className="checkbox checkbox-primary"
                  />
                  <div>
                    <div className="font-medium">Active</div>
                    <div className="text-xs text-base-content/60">
                      Store is available for workflow actions.
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <input
                    {...createForm.register('isChecked')}
                    type="checkbox"
                    title="Set store as checked or reviewed"
                    className="checkbox checkbox-info"
                  />
                  <div>
                    <div className="font-medium">Checked / Reviewed</div>
                    <div className="text-xs text-base-content/60">
                      Mark this store as reviewed.
                    </div>
                  </div>
                </label>
              </div>

              <div className="modal-action mt-6">
                <button
                  type="button"
                  title="Cancel creating store"
                  className="btn btn-ghost"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  title="Create store"
                  className={`btn btn-primary ${
                    createForm.formState.isSubmitting ? 'btn-disabled' : ''
                  }`}
                >
                  {createForm.formState.isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Creating
                    </>
                  ) : (
                    'Create Store'
                  )}
                </button>
              </div>
            </form>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button title="Close create store modal">close</button>
          </form>
        </dialog>

        {/* Edit Modal */}
        <dialog ref={editModalRef} className="modal">
          <div className="modal-box max-w-3xl rounded-3xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-base-content">
                  Edit Store
                </h3>

                <p className="mt-1 text-sm text-base-content/70">
                  Update store details and workflow status.
                </p>
              </div>

              <button
                type="button"
                title="Close edit store modal"
                className="btn btn-sm btn-circle btn-ghost"
                onClick={closeEditModal}
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="form-control">
                  <label className="label" htmlFor="edit-store-name">
                    <span className="label-text">Store Name</span>
                  </label>

                  <input
                    id="edit-store-name"
                    {...editForm.register('name', {
                      required: 'Store name is required',
                      minLength: {
                        value: 2,
                        message: 'Store name must be at least 2 characters',
                      },
                    })}
                    type="text"
                    title="Store name"
                    className="input input-bordered w-full"
                    placeholder="Gymshark"
                    dir="ltr"
                    autoFocus
                  />

                  {editForm.formState.errors.name?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {editForm.formState.errors.name.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="edit-store-domain">
                    <span className="label-text">Domain</span>
                  </label>

                  <input
                    id="edit-store-domain"
                    {...editForm.register('domain', {
                      required: 'Domain is required',
                    })}
                    type="text"
                    title="Store domain"
                    className="input input-bordered w-full"
                    placeholder="gymshark.com"
                    dir="ltr"
                  />

                  {editForm.formState.errors.domain?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {editForm.formState.errors.domain.message}
                      </span>
                    </label>
                  )}
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="edit-store-country">
                    <span className="label-text">Country</span>
                  </label>

                  <input
                    id="edit-store-country"
                    {...editForm.register('country')}
                    type="text"
                    title="Store country"
                    className="input input-bordered w-full"
                    placeholder="UK"
                    dir="ltr"
                  />
                </div>

                <div className="form-control">
                  <label className="label" htmlFor="edit-contact-name">
                    <span className="label-text">Contact Name</span>
                  </label>

                  <input
                    id="edit-contact-name"
                    {...editForm.register('contactName')}
                    type="text"
                    title="Contact person name"
                    className="input input-bordered w-full"
                    placeholder="John Doe"
                    dir="ltr"
                  />
                </div>

                <div className="form-control md:col-span-2">
                  <label className="label" htmlFor="edit-contact-email">
                    <span className="label-text">Contact Email</span>
                  </label>

                  <input
                    id="edit-contact-email"
                    {...editForm.register('contactEmail', {
                      pattern: {
                        value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                        message: 'Enter a valid email address',
                      },
                    })}
                    type="email"
                    title="Contact email address"
                    className="input input-bordered w-full"
                    placeholder="team@gymshark.com"
                    dir="ltr"
                  />

                  {editForm.formState.errors.contactEmail?.message && (
                    <label className="label">
                      <span className="label-text-alt text-error">
                        {editForm.formState.errors.contactEmail.message}
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <div className="form-control">
                <label className="label" htmlFor="edit-store-notes">
                  <span className="label-text">Notes</span>
                </label>

                <textarea
                  id="edit-store-notes"
                  {...editForm.register('notes')}
                  title="Internal notes for this store"
                  className="textarea textarea-bordered min-h-[130px] w-full"
                  placeholder="Internal notes about this store"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <input
                    {...editForm.register('isActive')}
                    type="checkbox"
                    title="Set store as active"
                    className="checkbox checkbox-primary"
                  />
                  <div>
                    <div className="font-medium">Active</div>
                    <div className="text-xs text-base-content/60">
                      Store is available for workflow actions.
                    </div>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-base-300 bg-base-200/50 p-4">
                  <input
                    {...editForm.register('isChecked')}
                    type="checkbox"
                    title="Set store as checked or reviewed"
                    className="checkbox checkbox-info"
                  />
                  <div>
                    <div className="font-medium">Checked / Reviewed</div>
                    <div className="text-xs text-base-content/60">
                      Mark this store as reviewed.
                    </div>
                  </div>
                </label>
              </div>

              <div className="modal-action mt-6">
                <button
                  type="button"
                  title="Cancel editing store"
                  className="btn btn-ghost"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  title="Save store changes"
                  className={`btn btn-primary ${
                    editForm.formState.isSubmitting ? 'btn-disabled' : ''
                  }`}
                >
                  {editForm.formState.isSubmitting ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Saving
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button title="Close edit store modal">close</button>
          </form>
        </dialog>

        {/* Details Modal */}
        <dialog ref={detailsModalRef} className="modal">
          <div className="modal-box max-h-[90vh] max-w-6xl overflow-hidden rounded-3xl p-0">
            <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100 p-5 md:p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-bold text-base-content">
                      {detailsStore?.name || 'Store Details'}
                    </h3>

                    {detailsStore?.isActive ? (
                      <span className="badge badge-success badge-outline">
                        Active
                      </span>
                    ) : (
                      <span className="badge badge-ghost">Inactive</span>
                    )}

                    {detailsStore?.isChecked ? (
                      <span className="badge badge-info badge-outline">
                        Checked
                      </span>
                    ) : (
                      <span className="badge badge-ghost">Pending review</span>
                    )}
                  </div>

                  {detailsStore?.domain && (
                    <a
                      href={`https://${detailsStore.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link-hover link mt-2 inline-block text-sm"
                    >
                      {detailsStore.domain}
                    </a>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {detailsStore && (
                    <button
                      type="button"
                      title={`Find contact points for ${detailsStore.domain}`}
                      className={`btn btn-secondary btn-outline btn-sm ${
                        discoveringId === detailsStore._id || isBulkChecking
                          ? 'btn-disabled'
                          : ''
                      }`}
                      onClick={() => handleDiscoverStoreContacts(detailsStore)}
                    >
                      {discoveringId === detailsStore._id
                        ? 'Finding...'
                        : 'Find Contacts'}
                    </button>
                  )}

                  {detailsStore && (
                    <button
                      type="button"
                      title={`Edit ${detailsStore.name}`}
                      className="btn btn-outline btn-sm"
                      onClick={() => {
                        closeDetailsModal();
                        openEditModal(detailsStore);
                      }}
                    >
                      Edit
                    </button>
                  )}

                  <button
                    type="button"
                    title="Close details modal"
                    className="btn btn-sm btn-circle btn-ghost"
                    onClick={closeDetailsModal}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div className="max-h-[calc(90vh-96px)] overflow-y-auto p-5 md:p-6">
              {!detailsStore ? (
                <div className="py-12 text-center text-base-content/60">
                  No store selected.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-base-content/50">
                        Country
                      </div>
                      <div className="mt-1 font-semibold">
                        {detailsStore.country || '-'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-base-content/50">
                        Contact Name
                      </div>
                      <div className="mt-1 font-semibold">
                        {detailsStore.contactName || '-'}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-base-content/50">
                        Contact Email
                      </div>
                      <div className="mt-1 break-all font-semibold">
                        {detailsStore.contactEmail ? (
                          <a
                            href={`mailto:${detailsStore.contactEmail}`}
                            className="link-hover link"
                          >
                            {detailsStore.contactEmail}
                          </a>
                        ) : (
                          '-'
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-base-300 bg-base-200/50 p-4">
                      <div className="text-xs uppercase tracking-wide text-base-content/50">
                        Checked At
                      </div>
                      <div className="mt-1 font-semibold">
                        {formatDateTime(detailsStore.checkedAt)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-lg font-semibold">
                        Contact Discovery
                      </h4>

                      {detailsDiscovery?.status ? (
                        <span
                          className={`badge badge-outline ${getDiscoveryStatusClass(
                            detailsDiscovery.status
                          )}`}
                        >
                          {detailsDiscovery.status}
                        </span>
                      ) : (
                        <span className="badge badge-ghost">
                          Not discovered
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
                      <div className="rounded-2xl bg-primary/10 p-4">
                        <div className="text-xs text-primary">Emails</div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.emails}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-info/10 p-4">
                        <div className="text-xs text-info">Socials</div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.socialProfiles}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-warning/10 p-4">
                        <div className="text-xs text-warning">Phones</div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.phones}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-success/10 p-4">
                        <div className="text-xs text-success">Forms</div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.contactForms}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-base-200/70 p-4">
                        <div className="text-xs text-base-content/60">
                          Pages
                        </div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.pages}
                        </div>
                      </div>

                      <div className="rounded-2xl bg-error/10 p-4">
                        <div className="text-xs text-error">Errors</div>
                        <div className="mt-1 text-xl font-bold">
                          {detailsCounts.errors}
                        </div>
                      </div>
                    </div>
                  </div>

                  {detailsStore.notes && (
                    <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
                      <h4 className="mb-2 font-semibold">Notes</h4>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-base-content/75">
                        {detailsStore.notes}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button title="Close details modal">close</button>
          </form>
        </dialog>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default StoresPage;