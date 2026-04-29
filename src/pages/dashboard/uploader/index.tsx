import { DashboardLayout } from '@/components/layouts';
import { Button } from '@/components/ui';
import api from '@/lib/axios';
import { withAuth } from '@/utils';
import { useEffect, useMemo, useState } from 'react';

type UploadedImage = {
  _id: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  path: string;
  provider: 'local';
  status: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
};

type UploadResponse = {
  success: boolean;
  message: string;
  data: UploadedImage;
};

const ImageUploaderPage = () => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [deletingId, setDeletingId] = useState('');

  const canUpload = useMemo(() => !!file && !isSubmitting, [file, isSubmitting]);

  const fetchImages = async () => {
    try {
      setIsLoadingImages(true);
      setServerError('');

      const response = await api.get('/upload/images');
      setImages(response?.data?.data || []);
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to fetch uploaded images.'
      );
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] || null;

    setServerError('');
    setImageUrl('');
    setFile(null);
    setPreviewUrl('');

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      setServerError('Please select a valid image file.');
      return;
    }

    if (selectedFile.size > 5 * 1024 * 1024) {
      setServerError('Image size must be less than 5MB.');
      return;
    }

    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
  };

  const onUpload = async () => {
    if (!file) {
      setServerError('Please select an image first.');
      return;
    }

    try {
      setIsSubmitting(true);
      setServerError('');
      setImageUrl('');

      const formData = new FormData();
      formData.append('image', file, file.name);

      const response = await api.post<UploadResponse>('/upload/image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const uploadedUrl = response?.data?.data?.url || '';

      setImageUrl(uploadedUrl);
      setFile(null);
      setPreviewUrl('');

      await fetchImages();
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to upload image.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const onDelete = async (id: string) => {
    if (!id) return;

    try {
      setDeletingId(id);
      setServerError('');

      await api.delete(`/upload/images/${id}`);

      setImages((current) => current.filter((image) => image._id !== id));
    } catch (error: any) {
      console.log(error);
      setServerError(
        error?.response?.data?.message ||
          error?.response?.data?.detail ||
          error?.response?.data?.error ||
          'Failed to delete image.'
      );
    } finally {
      setDeletingId('');
    }
  };

  const copyUrl = async (url: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
  };

  const formatFileSize = (size: number) => {
    if (!size) return '0 KB';

    const kb = size / 1024;

    if (kb < 1024) {
      return `${kb.toFixed(1)} KB`;
    }

    return `${(kb / 1024).toFixed(2)} MB`;
  };

  return (
    <DashboardLayout>
      <div className="py-8" dir="ltr">
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                  Image Uploader
                </h1>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Upload an image, save it in MongoDB, and get a public link address.
                </p>
              </div>

              <Button
                type="button"
                onClick={onUpload}
                disabled={!canUpload}
                isLoading={isSubmitting}
              >
                Upload Image
              </Button>
            </div>

            {serverError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300">
                {serverError}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Select image
            </label>

            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onFileChange}
              className="mt-3 block w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />

            {previewUrl && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="max-h-[420px] w-full object-contain"
                />
              </div>
            )}
          </div>

          {imageUrl && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-200">
                Upload completed
              </h2>

              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <input
                  readOnly
                  value={imageUrl}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-4 py-3 text-sm text-gray-800 dark:border-emerald-900 dark:bg-gray-950 dark:text-gray-200"
                />

                <Button type="button" onClick={() => copyUrl(imageUrl)}>
                  Copy Link
                </Button>
              </div>

              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-medium text-emerald-700 underline dark:text-emerald-300"
              >
                Open uploaded image
              </a>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Previous Uploaded Images
                </h2>

                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Active uploaded images saved in MongoDB.
                </p>
              </div>

              <Button type="button" onClick={fetchImages} disabled={isLoadingImages}>
                Refresh
              </Button>
            </div>

            {isLoadingImages && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div
                    key={item}
                    className="h-64 animate-pulse rounded-2xl bg-gray-200 dark:bg-gray-800"
                  />
                ))}
              </div>
            )}

            {!isLoadingImages && images.length === 0 && (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  No uploaded images yet
                </h3>

                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Upload your first image and it will appear here.
                </p>
              </div>
            )}

            {!isLoadingImages && images.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {images.map((image) => (
                  <div
                    key={image._id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <img
                      src={image.url}
                      alt={image.originalName || image.filename}
                      className="h-44 w-full object-cover"
                    />

                    <div className="space-y-3 p-4">
                      <div>
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {image.originalName || image.filename}
                        </p>

                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {image.mimetype} · {formatFileSize(image.size)}
                        </p>

                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          {new Date(image.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {image.url}
                      </p>

                      <div className="grid grid-cols-3 gap-2">
                        <Button type="button" onClick={() => copyUrl(image.url)}>
                          Copy
                        </Button>

                        <a
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-xl border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          Open
                        </a>

                        <Button
                          type="button"
                          onClick={() => onDelete(image._id)}
                          disabled={deletingId === image._id}
                          isLoading={deletingId === image._id}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export const getServerSideProps = withAuth();
export default ImageUploaderPage;