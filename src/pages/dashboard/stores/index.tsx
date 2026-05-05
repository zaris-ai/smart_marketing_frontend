import { DashboardLayout } from '@/components/layouts';
import Pagination, {
  type PaginationMeta,
} from '@/components/common/Pagination';
import { Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

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
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
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

const StoresPage = () => {
  const createModalRef = useRef<HTMLDialogElement | null>(null);
  const editModalRef = useRef<HTMLDialogElement | null>(null);
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
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [deletingId, setDeletingId] = useState('');
  const [checkingId, setCheckingId] = useState('');
  const [editingStore, setEditingStore] = useState<Store | null>(null);

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
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to load stores.';

      setListError(message);
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
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to create store.';

      toast.error(message);
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
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to update store.';

      toast.error(message);
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
      await fetchStores({ page: nextPage, limit });
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to delete store.';

      toast.error(message);
    } finally {
      setDeletingId('');
    }
  };

  const handleDeleteStore = (store: Store) => {
    toast.dismiss();

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
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Failed to update checked status.';

      toast.error(message);
    } finally {
      setCheckingId('');
    }
  };

  const handleApplyFilters = async (e: React.FormEvent) => {
    e.preventDefault();

    setPage(1);
    setIsRefreshing(true);

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

    await fetchStores({ page: nextPage, limit });
  };

  const handleLimitChange = async (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);
    setIsRefreshing(true);

    await fetchStores({
      page: 1,
      limit: nextLimit,
    });
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

    const confirmed = window.confirm(
      'This will add new stores from the uploaded JSON file. Existing stores will not be removed. Duplicate domains will be skipped. Continue?'
    );

    if (!confirmed) return;

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

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchStores({ page: 1, limit });
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to import stores from JSON.';

      toast.error(message);
    } finally {
      setIsImporting(false);
      setUploadProgress(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
            <div className="p-6 md:p-8">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-base-content">
                    Stores
                  </h1>

                  <p className="mt-2 text-sm text-base-content/70">
                    Manage Shopify stores, CRM workflow status, filters and JSON
                    imports.
                  </p>
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={openCreateModal}
                >
                  Create Store
                </button>
              </div>

              <div className="mb-6 rounded-2xl border border-info/30 bg-info/5 p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-base-content">
                      Import Stores from JSON
                    </h2>

                    <p className="mt-1 text-sm text-base-content/70">
                      Upload a large JSON array. The server streams the file,
                      customizes fields for your Store database, then adds only
                      new stores.
                    </p>

                    <p className="mt-2 text-sm font-medium text-info">
                      Existing stores will not be removed. Duplicate domains
                      will be skipped.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="form-control flex-1">
                    <label className="label">
                      <span className="label-text">JSON File</span>
                    </label>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="file-input file-input-bordered w-full"
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
                    className={`btn btn-info ${
                      isImporting ? 'btn-disabled' : ''
                    }`}
                    onClick={handleImportFromJson}
                  >
                    {isImporting ? 'Importing...' : 'Import Stores'}
                  </button>
                </div>

                {jsonFile && (
                  <div className="mt-3 text-sm text-base-content/70">
                    Selected file:{' '}
                    <span className="font-medium text-base-content">
                      {jsonFile.name}
                    </span>
                  </div>
                )}

                {uploadProgress !== null && (
                  <div className="mt-4">
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

                {isImporting && uploadProgress === null && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                    <span className="loading loading-spinner loading-sm" />
                    Processing file on server...
                  </div>
                )}

                {importResult && (
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Total Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {importResult.totalRows}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Valid Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {importResult.validRows}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Inserted
                      </div>
                      <div className="mt-1 text-xl font-semibold text-success">
                        {importResult.insertedCount}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Skipped Existing
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {importResult.skippedExistingCount}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Duplicate In File
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {importResult.duplicateInBatchCount}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Invalid Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold text-error">
                        {importResult.invalidCount}
                      </div>
                    </div>
                  </div>
                )}

                {importResult?.invalidRows?.length ? (
                  <div className="mt-5 overflow-x-auto rounded-xl border border-base-300 bg-base-100">
                    <table className="table table-sm">
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

              <div className="mb-6 rounded-2xl border border-base-300 bg-base-200/40 p-5">
                <form
                  onSubmit={handleApplyFilters}
                  className="grid grid-cols-1 gap-4 md:grid-cols-6"
                >
                  <div className="md:col-span-2">
                    <Input
                      value={search}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setSearch(e.target.value)
                      }
                      type="text"
                      label="Search"
                      placeholder="Search by name, domain, country, or email"
                      dir="ltr"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Active</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={activeFilter}
                      onChange={(e) => setActiveFilter(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Checked</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={checkedFilter}
                      onChange={(e) => setCheckedFilter(e.target.value)}
                    >
                      <option value="">All</option>
                      <option value="true">Checked</option>
                      <option value="false">Not checked</option>
                    </select>
                  </div>

                  <div>
                    <Input
                      value={countryFilter}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCountryFilter(e.target.value)
                      }
                      type="text"
                      label="Country"
                      placeholder="Canada"
                      dir="ltr"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Sort By</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="createdAt">Created</option>
                      <option value="updatedAt">Updated</option>
                      <option value="checkedAt">Checked Date</option>
                      <option value="name">Name</option>
                      <option value="domain">Domain</option>
                      <option value="country">Country</option>
                    </select>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Order</span>
                    </label>

                    <select
                      className="select select-bordered"
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as 'asc' | 'desc')
                      }
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-2 md:col-span-6">
                    <button
                      type="submit"
                      className={`btn btn-outline ${
                        isRefreshing ? 'btn-disabled' : ''
                      }`}
                    >
                      {isRefreshing ? 'Filtering...' : 'Apply Filters'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={handleResetFilters}
                    >
                      Reset
                    </button>
                  </div>
                </form>
              </div>

              {listError && (
                <div className="alert alert-error mb-5">
                  <span>{listError}</span>
                </div>
              )}

              {isListLoading ? (
                <div className="flex items-center justify-center py-16">
                  <span className="loading loading-spinner loading-md" />
                </div>
              ) : stores.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-base-300 bg-base-200/40 px-6 py-12 text-center">
                  <h2 className="text-lg font-medium text-base-content">
                    No stores found
                  </h2>

                  <p className="mt-2 text-sm text-base-content/70">
                    Create the first store, import JSON, or adjust filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-base-300">
                  <div className="overflow-x-auto">
                    <table className="table table-zebra">
                      <thead>
                        <tr>
                          <th>Checked</th>
                          <th>Name</th>
                          <th>Domain</th>
                          <th>Country</th>
                          <th>Contact Name</th>
                          <th>Contact Email</th>
                          <th>Status</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {stores.map((store) => (
                          <tr key={store._id}>
                            <td>
                              <label className="label cursor-pointer justify-start gap-2">
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-primary checkbox-sm"
                                  checked={Boolean(store.isChecked)}
                                  disabled={checkingId === store._id}
                                  onChange={() => toggleStoreChecked(store)}
                                />

                                {store.isChecked ? (
                                  <span className="badge badge-info badge-outline">
                                    Checked
                                  </span>
                                ) : (
                                  <span className="badge badge-ghost">No</span>
                                )}
                              </label>
                            </td>

                            <td className="font-medium">{store.name}</td>
                            <td>{store.domain}</td>
                            <td>{store.country || '-'}</td>
                            <td>{store.contactName || '-'}</td>
                            <td>{store.contactEmail || '-'}</td>

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

                            <td className="text-right">
                              <div className="flex justify-end gap-2">
                                <Link
                                  href={{
                                    pathname: '/dashboard/outreach',
                                    query: { storeId: store._id },
                                  }}
                                  className="btn btn-sm btn-success btn-outline"
                                >
                                  Outreach
                                </Link>

                                <Link
                                  href={`/dashboard/stores/${store._id}/crm`}
                                  className="btn btn-sm btn-info btn-outline"
                                >
                                  CRM
                                </Link>

                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline"
                                  onClick={() => openEditModal(store)}
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  className={`btn btn-sm btn-error btn-outline ${
                                    deletingId === store._id
                                      ? 'btn-disabled'
                                      : ''
                                  }`}
                                  onClick={() => handleDeleteStore(store)}
                                >
                                  {deletingId === store._id
                                    ? 'Deleting...'
                                    : 'Delete'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <Pagination
                    pagination={pagination}
                    isLoading={isRefreshing || isListLoading}
                    onPageChange={handlePageChange}
                    onLimitChange={handleLimitChange}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        <dialog ref={createModalRef} className="modal">
          <div className="modal-box max-w-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-base-content">
                  Create Store
                </h3>

                <p className="mt-1 text-sm text-base-content/70">
                  Platform is fixed as Shopify.
                </p>
              </div>

              <button
                type="button"
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
                <Input
                  {...createForm.register('name', {
                    required: 'Store name is required',
                    minLength: {
                      value: 2,
                      message: 'Store name must be at least 2 characters',
                    },
                  })}
                  type="text"
                  label="Store Name"
                  placeholder="Gymshark"
                  error={createForm.formState.errors.name?.message}
                  dir="ltr"
                  autoFocus
                />

                <Input
                  {...createForm.register('domain', {
                    required: 'Domain is required',
                  })}
                  type="text"
                  label="Domain"
                  placeholder="gymshark.com"
                  error={createForm.formState.errors.domain?.message}
                  dir="ltr"
                />

                <Input
                  {...createForm.register('country')}
                  type="text"
                  label="Country"
                  placeholder="UK"
                  error={createForm.formState.errors.country?.message}
                  dir="ltr"
                />

                <Input
                  {...createForm.register('contactName')}
                  type="text"
                  label="Contact Name"
                  placeholder="John Doe"
                  error={createForm.formState.errors.contactName?.message}
                  dir="ltr"
                />

                <Input
                  {...createForm.register('contactEmail', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  })}
                  type="email"
                  label="Contact Email"
                  placeholder="team@gymshark.com"
                  error={createForm.formState.errors.contactEmail?.message}
                  dir="ltr"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Notes</span>
                </label>

                <textarea
                  {...createForm.register('notes')}
                  className="textarea textarea-bordered min-h-[120px] w-full"
                  placeholder="Internal notes about this store"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      {...createForm.register('isActive')}
                      type="checkbox"
                      className="checkbox checkbox-primary"
                    />
                    <span className="label-text">Active</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      {...createForm.register('isChecked')}
                      type="checkbox"
                      className="checkbox checkbox-info"
                    />
                    <span className="label-text">Checked / Reviewed</span>
                  </label>
                </div>
              </div>

              <div className="modal-action mt-6">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeCreateModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`btn btn-primary ${
                    createForm.formState.isSubmitting ? 'btn-disabled' : ''
                  }`}
                >
                  {createForm.formState.isSubmitting
                    ? 'Creating...'
                    : 'Create Store'}
                </button>
              </div>
            </form>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>

        <dialog ref={editModalRef} className="modal">
          <div className="modal-box max-w-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-base-content">
                  Edit Store
                </h3>

                <p className="mt-1 text-sm text-base-content/70">
                  Update store details and workflow status.
                </p>
              </div>

              <button
                type="button"
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
                <Input
                  {...editForm.register('name', {
                    required: 'Store name is required',
                    minLength: {
                      value: 2,
                      message: 'Store name must be at least 2 characters',
                    },
                  })}
                  type="text"
                  label="Store Name"
                  placeholder="Gymshark"
                  error={editForm.formState.errors.name?.message}
                  dir="ltr"
                  autoFocus
                />

                <Input
                  {...editForm.register('domain', {
                    required: 'Domain is required',
                  })}
                  type="text"
                  label="Domain"
                  placeholder="gymshark.com"
                  error={editForm.formState.errors.domain?.message}
                  dir="ltr"
                />

                <Input
                  {...editForm.register('country')}
                  type="text"
                  label="Country"
                  placeholder="UK"
                  error={editForm.formState.errors.country?.message}
                  dir="ltr"
                />

                <Input
                  {...editForm.register('contactName')}
                  type="text"
                  label="Contact Name"
                  placeholder="John Doe"
                  error={editForm.formState.errors.contactName?.message}
                  dir="ltr"
                />

                <Input
                  {...editForm.register('contactEmail', {
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: 'Enter a valid email address',
                    },
                  })}
                  type="email"
                  label="Contact Email"
                  placeholder="team@gymshark.com"
                  error={editForm.formState.errors.contactEmail?.message}
                  dir="ltr"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Notes</span>
                </label>

                <textarea
                  {...editForm.register('notes')}
                  className="textarea textarea-bordered min-h-[120px] w-full"
                  placeholder="Internal notes about this store"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      {...editForm.register('isActive')}
                      type="checkbox"
                      className="checkbox checkbox-primary"
                    />
                    <span className="label-text">Active</span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      {...editForm.register('isChecked')}
                      type="checkbox"
                      className="checkbox checkbox-info"
                    />
                    <span className="label-text">Checked / Reviewed</span>
                  </label>
                </div>
              </div>

              <div className="modal-action mt-6">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeEditModal}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={`btn btn-primary ${
                    editForm.formState.isSubmitting ? 'btn-disabled' : ''
                  }`}
                >
                  {editForm.formState.isSubmitting
                    ? 'Saving...'
                    : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>

          <form method="dialog" className="modal-backdrop">
            <button>close</button>
          </form>
        </dialog>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default StoresPage;