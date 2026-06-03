import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
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

export class RequiredDocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsBoolean()
  isRequired: boolean;
}

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  slug: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsEnum(SERVICE_CATEGORIES)
  category: ServiceCategory;

  @IsInt()
  @Min(0)
  price: number;

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
