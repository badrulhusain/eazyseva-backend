import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeleteDocumentDto {
  @IsString()
  @IsNotEmpty()
  publicId: string;

  @IsOptional()
  @IsIn(['image', 'raw'], { message: 'resourceType must be "image" or "raw"' })
  resourceType: 'image' | 'raw' = 'image';
}
