import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RequiredDocumentDto } from './create-service.dto';
import type { ServiceCategory } from '../services.types';

const SERVICE_CATEGORIES = [
  'ID_CARD',
  'CERTIFICATE',
  'TRAVEL',
  'FINANCIAL',
  'VEHICLE',
  'PROPERTY',
  'SCHOLARSHIP',
  'FORM_FILLING',
  'GOVERNMENT_SCHEME',
] as const;

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsEnum(SERVICE_CATEGORIES)
  category?: ServiceCategory;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  govtFee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  processingFee?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  deliveryDaysMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  deliveryDaysMax?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RequiredDocumentDto)
  requiredDocuments?: RequiredDocumentDto[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  isPopular?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
