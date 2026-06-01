export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

// Cloudinary requires resource_type 'raw' for non-image binary files like PDF.
// All image MIME types map to resource_type 'image'.
export function resolveResourceType(mimetype: string): 'image' | 'raw' {
  return mimetype === 'application/pdf' ? 'raw' : 'image';
}
