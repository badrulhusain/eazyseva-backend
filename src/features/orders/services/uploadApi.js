import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

const getErrorMessage = (error, fallback) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'You appear to be offline. Please check your internet connection and try again.';
  }

  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
};

export async function uploadDocument(file, options = {}) {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_URL}/api/uploads/document`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: options.onUploadProgress,
      },
    );

    return response.data?.data ?? response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'Unable to upload document. Please try again.'),
    );
  }
}

export async function deleteUploadedDocument(publicId, resourceType) {
  try {
    const response = await axios.delete(`${API_URL}/api/uploads/document`, {
      data: { publicId, resourceType },
    });

    return response.data?.data ?? response.data;
  } catch (error) {
    throw new Error(
      getErrorMessage(error, 'Unable to remove uploaded document.'),
    );
  }
}
