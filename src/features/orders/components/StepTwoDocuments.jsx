import React, { useEffect, useMemo, useState } from 'react';
import DocumentUploadBox from './DocumentUploadBox';
import { deleteUploadedDocument } from '../services/uploadApi';
import {
  DOCUMENT_STATUS,
  useOrderFormStore,
} from '../store/orderFormStore';

export const SERVICE_DOCUMENT_REQUIREMENTS = {
  birth_certificate: [
    { name: 'aadhaarCard', label: 'Aadhaar Card' },
    { name: 'parentIdProof', label: 'Parent ID Proof' },
    { name: 'hospitalCertificate', label: 'Hospital Certificate' },
  ],
  income_certificate: [
    { name: 'aadhaarCard', label: 'Aadhaar Card' },
    { name: 'rationCard', label: 'Ration Card' },
    { name: 'incomeProof', label: 'Income Proof' },
  ],
  community_certificate: [
    { name: 'aadhaarCard', label: 'Aadhaar Card' },
    { name: 'schoolCertificate', label: 'School Certificate' },
    { name: 'parentCommunityProof', label: 'Parent Community Proof' },
  ],
};

export default function StepTwoDocuments({ serviceType, onNext }) {
  const [stepError, setStepError] = useState('');

  const storeServiceType = useOrderFormStore((state) => state.serviceType);
  const documents = useOrderFormStore((state) => state.documents);
  const documentUploadStatus = useOrderFormStore(
    (state) => state.documentUploadStatus,
  );
  const removeDocument = useOrderFormStore((state) => state.removeDocument);
  const nextStep = useOrderFormStore((state) => state.nextStep);

  const activeServiceType = serviceType ?? storeServiceType;
  const requiredDocuments = useMemo(
    () => SERVICE_DOCUMENT_REQUIREMENTS[activeServiceType] ?? [],
    [activeServiceType],
  );

  useEffect(() => {
    if (!activeServiceType) return;

    const requiredNames = new Set(requiredDocuments.map((item) => item.name));
    const staleDocuments = documents.filter(
      (document) => !requiredNames.has(document.name),
    );

    staleDocuments.forEach(async (document) => {
      try {
        if (document.publicId) {
          await deleteUploadedDocument(document.publicId, document.resourceType);
        }
      } finally {
        removeDocument(document.name);
      }
    });
  }, [activeServiceType, documents, removeDocument, requiredDocuments]);

  const uploadedCount = requiredDocuments.filter((requiredDocument) =>
    documents.some(
      (document) =>
        document.name === requiredDocument.name &&
        document.status === DOCUMENT_STATUS.UPLOADED &&
        document.url &&
        document.publicId,
    ),
  ).length;

  const hasUploadingDocument = requiredDocuments.some(
    (document) =>
      documentUploadStatus[document.name] === DOCUMENT_STATUS.UPLOADING,
  );
  const allRequiredDocumentsUploaded =
    requiredDocuments.length > 0 && uploadedCount === requiredDocuments.length;

  const handleNext = () => {
    if (!requiredDocuments.length) {
      setStepError('Please select a service before uploading documents.');
      return;
    }

    if (hasUploadingDocument) {
      setStepError('Please wait for all uploads to finish before continuing.');
      return;
    }

    if (!allRequiredDocumentsUploaded) {
      setStepError('Upload all required documents before continuing.');
      return;
    }

    setStepError('');
    nextStep();
    onNext?.();
  };

  return (
    <section className="w-full">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            Upload documents
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {uploadedCount} of {requiredDocuments.length} required documents uploaded
          </p>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 sm:w-52">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{
              width: requiredDocuments.length
                ? `${(uploadedCount / requiredDocuments.length) * 100}%`
                : '0%',
            }}
          />
        </div>
      </div>

      {requiredDocuments.length ? (
        <div className="grid gap-4">
          {requiredDocuments.map((document) => (
            <DocumentUploadBox key={document.name} document={document} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          Select a service type in Step 1 to see required documents.
        </div>
      )}

      {stepError ? (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {stepError}
        </p>
      ) : null}

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          className="w-full rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          onClick={handleNext}
          disabled={hasUploadingDocument}
        >
          Continue to review
        </button>
      </div>
    </section>
  );
}
