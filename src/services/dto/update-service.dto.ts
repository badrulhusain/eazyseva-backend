import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
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
  govt_fee?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  processing_fee?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  delivery_days_min?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  delivery_days_max?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  required_documents?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @IsOptional()
  @IsBoolean()
  is_popular?: boolean;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
