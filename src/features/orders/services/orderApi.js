import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const cleanDocumentsForOrder = (documents = []) =>
  documents.map(
    ({ name, originalName, url, publicId, resourceType, format, bytes }) => ({
      name,
      originalName,
      url,
      publicId,
      resourceType,
      format,
      bytes,
    }),
  );

export async function createOrder(orderDraft) {
  try {
    const payload = {
      ...orderDraft,
      documents: cleanDocumentsForOrder(orderDraft.documents),
    };

    const response = await axios.post(`${API_URL}/api/orders`, payload);
    return response.data?.data ?? response.data;
  } catch (error) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error(
        'You appear to be offline. Please check your internet connection and try again.',
      );
    }

    throw new Error(
      error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Unable to place order. Please try again.',
    );
  }
}

export { cleanDocumentsForOrder };
