import React, { useRef, useState } from 'react';
import { deleteUploadedDocument, uploadDocument } from '../services/uploadApi';
import {
  DOCUMENT_STATUS,
  useOrderFormStore,
} from '../store/orderFormStore';
import UploadProgress from './UploadProgress';

const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const formatBytes = (bytes = 0) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
};

const validateFile = (file) => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return 'Only JPG, PNG, WebP, and PDF files are allowed.';
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File size must be 5MB or less.';
  }

  return '';
};

export default function DocumentUploadBox({ document }) {
  const inputRef = useRef(null);
  const retryFileRef = useRef(null);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const [isRemoving, setIsRemoving] = useState(false);

  const storedDocument = useOrderFormStore((state) =>
    state.documents.find((item) => item.name === document.name),
  );
  const status = useOrderFormStore(
    (state) =>
      state.documentUploadStatus[document.name] ?? DOCUMENT_STATUS.IDLE,
  );
  const setDocument = useOrderFormStore((state) => state.setDocument);
  const removeDocument = useOrderFormStore((state) => state.removeDocument);
  const setDocumentUploadStatus = useOrderFormStore(
    (state) => state.setDocumentUploadStatus,
  );

  const handleUpload = async (file) => {
    const validationError = validateFile(file);

    if (validationError) {
      retryFileRef.current = null;
      setError(validationError);
      setDocumentUploadStatus(document.name, DOCUMENT_STATUS.FAILED);
      return;
    }

    retryFileRef.current = file;
    setError('');
    setProgress(0);
    setDocumentUploadStatus(document.name, DOCUMENT_STATUS.UPLOADING);

    try {
      const metadata = await uploadDocument(file, {
        onUploadProgress: (event) => {
          if (!event.total) return;
          setProgress(Math.round((event.loaded * 100) / event.total));
        },
      });

      setDocument({
        name: document.name,
        label: document.label,
        originalName: metadata.originalName ?? file.name,
        url: metadata.url,
        publicId: metadata.publicId,
        resourceType: metadata.resourceType,
        format: metadata.format,
        bytes: metadata.bytes,
      });
      retryFileRef.current = null;
      setProgress(100);
    } catch (uploadError) {
      setError(uploadError.message);
      setDocumentUploadStatus(document.name, DOCUMENT_STATUS.FAILED);
    } finally {
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
  };

  const handleRetry = () => {
    if (retryFileRef.current) {
      handleUpload(retryFileRef.current);
      return;
    }

    inputRef.current?.click();
  };

  const handleRemove = async () => {
    if (!storedDocument) return;

    setIsRemoving(true);
    setError('');

    try {
      await deleteUploadedDocument(
        storedDocument.publicId,
        storedDocument.resourceType,
      );
      removeDocument(document.name);
    } catch (removeError) {
      setError(removeError.message);
    } finally {
      setIsRemoving(false);
    }
  };

  const isUploading = status === DOCUMENT_STATUS.UPLOADING;
  const isUploaded = status === DOCUMENT_STATUS.UPLOADED && storedDocument;
  const isFailed = status === DOCUMENT_STATUS.FAILED;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-950">
            {document.label}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            JPG, PNG, WebP, or PDF. Maximum 5MB.
          </p>

          {isUploaded ? (
            <div className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p className="truncate font-medium">{storedDocument.originalName}</p>
              <p className="text-xs text-slate-500">
                {[storedDocument.format?.toUpperCase(), formatBytes(storedDocument.bytes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:items-end">
          <UploadProgress status={status} progress={progress} />

          <div className="flex flex-wrap gap-2 sm:justify-end">
            {!isUploaded ? (
              <button
                type="button"
                className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Choose file'}
              </button>
            ) : null}

            {isFailed ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={handleRetry}
              >
                Retry
              </button>
            ) : null}

            {isUploaded ? (
              <button
                type="button"
                className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleRemove}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Remove'}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={ALLOWED_FILE_TYPES.join(',')}
        onChange={handleFileChange}
      />
    </div>
  );
}
