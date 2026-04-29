import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/config/api';
import { withAuth } from '@/utils/withAuth';
import { useSession } from 'next-auth/react';
import { FormEvent, useEffect, useMemo, useState } from 'react';

type AdminUser = {
  _id?: string;
  id?: string;
  username: string;
  createdAt?: string;
  updatedAt?: string;
};

type CreateAdminForm = {
  username: string;
  password: string;
};

type EditAdminForm = {
  username: string;
  password: string;
};

function UsersList() {
  const { data: session } = useSession();

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [listError, setListError] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [isCreateLoading, setIsCreateLoading] = useState(false);
  const [isEditLoading, setIsEditLoading] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const [createError, setCreateError] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const [createSuccess, setCreateSuccess] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [deleteSuccess, setDeleteSuccess] = useState('');

  const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);

  const [createForm, setCreateForm] = useState<CreateAdminForm>({
    username: '',
    password: '',
  });

  const [editForm, setEditForm] = useState<EditAdminForm>({
    username: '',
    password: '',
  });

  const authHeaders = useMemo(() => {
    return session?.accessToken
      ? {
          Authorization: `Bearer ${session.accessToken}`,
        }
      : {};
  }, [session?.accessToken]);

  const fetchAdmins = async () => {
    try {
      setIsLoading(true);
      setListError('');

      const response = await api.get('/users/admins', {
        headers: authHeaders,
      });

      const items =
        response.data?.users ||
        response.data?.admins ||
        response.data?.data ||
        [];

      setAdmins(Array.isArray(items) ? items : []);
    } catch (error: any) {
      setListError(
        error?.response?.data?.message || 'Failed to load admin users.'
      );
      setAdmins([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.accessToken) {
      fetchAdmins();
    }
  }, [session?.accessToken]);

  const openCreateModal = () => {
    setCreateError('');
    setCreateSuccess('');
    setCreateForm({
      username: '',
      password: '',
    });
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreateLoading) return;
    setIsCreateModalOpen(false);
  };

  const openEditModal = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setEditError('');
    setEditSuccess('');
    setEditForm({
      username: admin.username,
      password: '',
    });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    if (isEditLoading) return;
    setIsEditModalOpen(false);
    setSelectedAdmin(null);
  };

  const openDeleteModal = (admin: AdminUser) => {
    setSelectedAdmin(admin);
    setDeleteError('');
    setDeleteSuccess('');
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    if (isDeleteLoading) return;
    setIsDeleteModalOpen(false);
    setSelectedAdmin(null);
  };

  const handleCreateAdmin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!createForm.username.trim() || !createForm.password.trim()) {
      setCreateError('Username and password are required.');
      return;
    }

    try {
      setIsCreateLoading(true);
      setCreateError('');
      setCreateSuccess('');

      await api.post(
        '/users/admins',
        {
          username: createForm.username.trim(),
          password: createForm.password,
        },
        {
          headers: authHeaders,
        }
      );

      setCreateSuccess('Admin created successfully.');
      await fetchAdmins();

      setCreateForm({
        username: '',
        password: '',
      });

      setTimeout(() => {
        setIsCreateModalOpen(false);
        setCreateSuccess('');
      }, 700);
    } catch (error: any) {
      setCreateError(
        error?.response?.data?.message || 'Failed to create admin user.'
      );
    } finally {
      setIsCreateLoading(false);
    }
  };

  const handleEditAdmin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!selectedAdmin?._id && !selectedAdmin?.id) {
      setEditError('No admin selected.');
      return;
    }

    if (!editForm.username.trim()) {
      setEditError('Username is required.');
      return;
    }

    try {
      setIsEditLoading(true);
      setEditError('');
      setEditSuccess('');

      const adminId = selectedAdmin._id || selectedAdmin.id;

      await api.put(
        `/users/admins/${adminId}`,
        {
          username: editForm.username.trim(),
          password: editForm.password.trim() || undefined,
        },
        {
          headers: authHeaders,
        }
      );

      setEditSuccess('Admin updated successfully.');
      await fetchAdmins();

      setTimeout(() => {
        setIsEditModalOpen(false);
        setEditSuccess('');
        setSelectedAdmin(null);
      }, 700);
    } catch (error: any) {
      setEditError(
        error?.response?.data?.message || 'Failed to update admin user.'
      );
    } finally {
      setIsEditLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin?._id && !selectedAdmin?.id) {
      setDeleteError('No admin selected.');
      return;
    }

    try {
      setIsDeleteLoading(true);
      setDeleteError('');
      setDeleteSuccess('');

      const adminId = selectedAdmin._id || selectedAdmin.id;

      await api.delete(`/users/admins/${adminId}`, {
        headers: authHeaders,
      });

      setDeleteSuccess('Admin deleted successfully.');
      await fetchAdmins();

      setTimeout(() => {
        setIsDeleteModalOpen(false);
        setDeleteSuccess('');
        setSelectedAdmin(null);
      }, 700);
    } catch (error: any) {
      setDeleteError(
        error?.response?.data?.message || 'Failed to delete admin user.'
      );
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Admins</h1>
            <p className="mt-1 text-sm text-base-content/70">
              Manage admin accounts.
            </p>
          </div>

          <Button onClick={openCreateModal}>
            Create New Admin
          </Button>
        </div>

        {listError ? (
          <div className="alert alert-error">
            <span>{listError}</span>
          </div>
        ) : null}

        <div className="rounded-2xl border border-base-300 bg-base-100 shadow-sm">
          <div className="border-b border-base-300 px-5 py-4">
            <h2 className="text-lg font-semibold">Admin Users</h2>
          </div>

          {isLoading ? (
            <div className="p-6">
              <div className="space-y-3">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </div>
          ) : admins.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-base-content/70">No admin users found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Username</th>
                    <th>Created At</th>
                    <th>Updated At</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((admin, index) => (
                    <tr key={admin._id || admin.id || `${admin.username}-${index}`}>
                      <td>{index + 1}</td>
                      <td className="font-medium">{admin.username}</td>
                      <td>
                        {admin.createdAt
                          ? new Date(admin.createdAt).toLocaleString()
                          : '-'}
                      </td>
                      <td>
                        {admin.updatedAt
                          ? new Date(admin.updatedAt).toLocaleString()
                          : '-'}
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn btn-sm btn-outline btn-info"
                            onClick={() => openEditModal(admin)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-sm btn-outline btn-error"
                            onClick={() => openDeleteModal(admin)}
                          >
                            Delete
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

        <div className={`modal ${isCreateModalOpen ? 'modal-open' : ''}`} role="dialog">
          <div className="modal-box max-w-lg rounded-2xl">
            <h3 className="text-xl font-bold">Create New Admin</h3>
            <p className="mt-1 text-sm text-base-content/70">
              Add a new admin account.
            </p>

            <form onSubmit={handleCreateAdmin} className="mt-6 space-y-4">
              {createError ? (
                <div className="alert alert-error">
                  <span>{createError}</span>
                </div>
              ) : null}

              {createSuccess ? (
                <div className="alert alert-success">
                  <span>{createSuccess}</span>
                </div>
              ) : null}

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Username</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter username"
                  value={createForm.username}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Password</span>
                </div>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="Enter password"
                  value={createForm.password}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeCreateModal}
                  disabled={isCreateLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isCreateLoading}
                >
                  {isCreateLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Creating...
                    </>
                  ) : (
                    'Create Admin'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="modal-backdrop" onClick={closeCreateModal}>
            <button type="button">close</button>
          </div>
        </div>

        <div className={`modal ${isEditModalOpen ? 'modal-open' : ''}`} role="dialog">
          <div className="modal-box max-w-lg rounded-2xl">
            <h3 className="text-xl font-bold">Edit Admin</h3>
            <p className="mt-1 text-sm text-base-content/70">
              Update username or set a new password.
            </p>

            <form onSubmit={handleEditAdmin} className="mt-6 space-y-4">
              {editError ? (
                <div className="alert alert-error">
                  <span>{editError}</span>
                </div>
              ) : null}

              {editSuccess ? (
                <div className="alert alert-success">
                  <span>{editSuccess}</span>
                </div>
              ) : null}

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">Username</span>
                </div>
                <input
                  type="text"
                  className="input input-bordered w-full"
                  placeholder="Enter username"
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                />
              </label>

              <label className="form-control w-full">
                <div className="label">
                  <span className="label-text">New Password</span>
                </div>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  placeholder="Leave empty to keep current password"
                  value={editForm.password}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
              </label>

              <div className="modal-action">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeEditModal}
                  disabled={isEditLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-info"
                  disabled={isEditLoading}
                >
                  {isEditLoading ? (
                    <>
                      <span className="loading loading-spinner loading-sm" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="modal-backdrop" onClick={closeEditModal}>
            <button type="button">close</button>
          </div>
        </div>

        <div className={`modal ${isDeleteModalOpen ? 'modal-open' : ''}`} role="dialog">
          <div className="modal-box max-w-md rounded-2xl">
            <h3 className="text-xl font-bold">Delete Admin</h3>
            <p className="mt-3 text-sm text-base-content/70">
              Are you sure you want to delete admin{' '}
              <span className="font-semibold">{selectedAdmin?.username}</span>?
            </p>

            {deleteError ? (
              <div className="alert alert-error mt-4">
                <span>{deleteError}</span>
              </div>
            ) : null}

            {deleteSuccess ? (
              <div className="alert alert-success mt-4">
                <span>{deleteSuccess}</span>
              </div>
            ) : null}

            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDeleteModal}
                disabled={isDeleteLoading}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-error"
                onClick={handleDeleteAdmin}
                disabled={isDeleteLoading}
              >
                {isDeleteLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>

          <div className="modal-backdrop" onClick={closeDeleteModal}>
            <button type="button">close</button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export const getServerSideProps = withAuth();

export default UsersList;