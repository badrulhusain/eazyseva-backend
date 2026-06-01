import { create } from 'zustand';

export const DOCUMENT_STATUS = {
  IDLE: 'idle',
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  FAILED: 'failed',
};

const initialState = {
  currentStep: 1,
  serviceType: '',
  customer: null,
  price: null,
  documents: [],
  documentUploadStatus: {},
};

const getDocumentKey = (documentOrName) =>
  typeof documentOrName === 'string' ? documentOrName : documentOrName.name;

export const useOrderFormStore = create((set, get) => ({
  ...initialState,

  setServiceType: (serviceType) => set({ serviceType }),

  setCustomer: (customer) => set({ customer }),
  setPrice: (price) => set({ price }),

  setDocument: (document) =>
    set((state) => ({
      documents: [
        ...state.documents.filter((item) => item.name !== document.name),
        { ...document, status: DOCUMENT_STATUS.UPLOADED },
      ],
      documentUploadStatus: {
        ...state.documentUploadStatus,
        [document.name]: DOCUMENT_STATUS.UPLOADED,
      },
    })),

  removeDocument: (documentOrName) => {
    const name = getDocumentKey(documentOrName);

    set((state) => {
      const nextStatus = { ...state.documentUploadStatus };
      delete nextStatus[name];

      return {
        documents: state.documents.filter((document) => document.name !== name),
        documentUploadStatus: nextStatus,
      };
    });
  },

  setDocumentUploadStatus: (name, status) =>
    set((state) => ({
      documentUploadStatus: {
        ...state.documentUploadStatus,
        [name]: status,
      },
    })),

  areRequiredDocumentsUploaded: (requiredDocuments = []) => {
    const documents = get().documents;

    return requiredDocuments.every((requiredDocument) =>
      documents.some(
        (document) =>
          document.name === requiredDocument.name &&
          document.status === DOCUMENT_STATUS.UPLOADED &&
          document.url &&
          document.publicId,
      ),
    );
  },

  nextStep: () =>
    set((state) => ({ currentStep: Math.min(state.currentStep + 1, 4) })),

  prevStep: () =>
    set((state) => ({ currentStep: Math.max(state.currentStep - 1, 1) })),

  resetOrderForm: () => set(initialState),
}));
