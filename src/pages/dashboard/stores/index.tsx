import { DashboardLayout } from '@/components/layouts';
import { Input } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import Pagination, {
  type PaginationMeta,
} from '@/components/common/Pagination';

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
};

type ReplaceImportResult = {
  totalRows: number;
  validRows: number;
  insertedCount: number;
  duplicateInFileCount: number;
  invalidCount: number;
  invalidRows?: {
    row: number;
    domain?: string;
    reason: string;
  }[];
};

const defaultFormValues: StoreFormData = {
  name: '',
  domain: '',
  country: '',
  contactName: '',
  contactEmail: '',
  notes: '',
  isActive: true,
};

const StoresPage = () => {
  const createModalRef = useRef<HTMLDialogElement | null>(null);
  const editModalRef = useRef<HTMLDialogElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [listError, setListError] = useState('');
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const [jsonFile, setJsonFile] = useState<File | null>(null);
  const [isReplacing, setIsReplacing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [replaceResult, setReplaceResult] = useState<ReplaceImportResult | null>(
    null
  );

  const createForm = useForm<StoreFormData>({
    defaultValues: defaultFormValues,
  });

  const editForm = useForm<StoreFormData>({
    defaultValues: defaultFormValues,
  });

  const fetchStores = async (
    query = search,
    nextPage = page,
    nextLimit = limit
  ) => {
    try {
      setListError('');

      const response = await api.get('/stores', {
        params: {
          page: nextPage,
          limit: nextLimit,
          ...(query ? { q: query } : {}),
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
    fetchStores('', 1, limit);
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
      });

      toast.success(response?.data?.message || 'Store created successfully.');
      await fetchStores(search);
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
      });

      toast.success(response?.data?.message || 'Store updated successfully.');
      await fetchStores(search);
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
      await fetchStores(search);
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
        onClick: () => { },
      },
      duration: 10000,
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsRefreshing(true);
    setPage(1);

    await fetchStores(search, 1, limit);
  };

  const handlePageChange = async (nextPage: number) => {
    setPage(nextPage);
    setIsRefreshing(true);

    await fetchStores(search, nextPage, limit);
  };

  const handleLimitChange = async (nextLimit: number) => {
    setLimit(nextLimit);
    setPage(1);
    setIsRefreshing(true);

    await fetchStores(search, 1, nextLimit);
  };

  const handleReplaceFromJson = async () => {
    if (!jsonFile) {
      toast.error('Please select a JSON file first.');
      return;
    }

    if (!jsonFile.name.toLowerCase().endsWith('.json')) {
      toast.error('Only .json files are allowed.');
      return;
    }

    const confirmed = window.confirm(
      'This will replace all existing stores with the uploaded JSON file. Existing stores will be removed after the new file is imported successfully. Continue?'
    );

    if (!confirmed) return;

    try {
      setIsReplacing(true);
      setUploadProgress(null);
      setReplaceResult(null);

      const formData = new FormData();
      formData.append('file', jsonFile);

      const response = await api.post('/stores/replace-json', formData, {
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

      setReplaceResult(result);

      toast.success(
        response?.data?.message || 'Stores replaced successfully from JSON.'
      );

      setJsonFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await fetchStores(search);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        'Failed to replace stores from JSON.';

      toast.error(message);
    } finally {
      setIsReplacing(false);
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
                    Manage Shopify stores from one place.
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

              <div className="mb-6 rounded-2xl border border-error/30 bg-error/5 p-5">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-base-content">
                      Replace Stores from JSON
                    </h2>
                    <p className="mt-1 text-sm text-base-content/70">
                      Upload a large JSON array. The server will stream the file,
                      customize fields for your Store database, then replace the
                      current stores collection after successful import.
                    </p>
                    <p className="mt-2 text-sm font-medium text-error">
                      Warning: this action replaces all existing stores.
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
                      disabled={isReplacing}
                      onChange={(e) => {
                        setJsonFile(e.target.files?.[0] || null);
                        setReplaceResult(null);
                        setUploadProgress(null);
                      }}
                    />
                  </div>

                  <button
                    type="button"
                    className={`btn btn-error ${isReplacing ? 'btn-disabled' : ''
                      }`}
                    onClick={handleReplaceFromJson}
                  >
                    {isReplacing ? 'Replacing...' : 'Replace Stores'}
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
                      className="progress progress-error w-full"
                      value={uploadProgress}
                      max={100}
                    />
                  </div>
                )}

                {isReplacing && uploadProgress === null && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-base-content/70">
                    <span className="loading loading-spinner loading-sm" />
                    Processing file on server...
                  </div>
                )}

                {replaceResult && (
                  <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Total Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {replaceResult.totalRows}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Valid Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {replaceResult.validRows}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Inserted
                      </div>
                      <div className="mt-1 text-xl font-semibold text-success">
                        {replaceResult.insertedCount}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Duplicates
                      </div>
                      <div className="mt-1 text-xl font-semibold">
                        {replaceResult.duplicateInFileCount}
                      </div>
                    </div>

                    <div className="rounded-xl bg-base-100 p-4">
                      <div className="text-xs text-base-content/60">
                        Invalid Rows
                      </div>
                      <div className="mt-1 text-xl font-semibold text-error">
                        {replaceResult.invalidCount}
                      </div>
                    </div>
                  </div>
                )}

                {replaceResult?.invalidRows?.length ? (
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
                        {replaceResult.invalidRows.map((row, index) => (
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

              <form
                onSubmit={handleSearch}
                className="mb-6 flex flex-col gap-3 md:flex-row"
              >
                <div className="flex-1">
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

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className={`btn btn-outline ${isRefreshing ? 'btn-disabled' : ''
                      }`}
                  >
                    {isRefreshing ? 'Searching...' : 'Search'}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={async () => {
                      setSearch('');
                      setPage(1);
                      setIsRefreshing(true);

                      await fetchStores('', 1, limit);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </form>

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
                    Create the first store or replace stores from JSON.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-base-300">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
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

                              <button
                                type="button"
                                className="btn btn-sm btn-outline"
                                onClick={() => openEditModal(store)}
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className={`btn btn-sm btn-error btn-outline ${deletingId === store._id ? 'btn-disabled' : ''
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
                  className={`btn btn-primary ${createForm.formState.isSubmitting ? 'btn-disabled' : ''
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
                  Update store details.
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
                  className={`btn btn-primary ${editForm.formState.isSubmitting ? 'btn-disabled' : ''
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
      <Pagination
        pagination={pagination}
        isLoading={isRefreshing || isListLoading}
        onPageChange={handlePageChange}
        onLimitChange={handleLimitChange}
      />
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();

export default StoresPage;