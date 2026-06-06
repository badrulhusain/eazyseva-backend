export class UploadResponseDto {
  secureUrl: string;
  publicId: string;
  originalName: string;
  format: string;
  bytes: number;
  resourceType: string;
  width?: number;
  height?: number;
}
