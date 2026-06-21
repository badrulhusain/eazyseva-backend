import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ServiceCategory } from '../services.types';

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'ID_CARD',
  'CERTIFICATE',
  'TRAVEL',
  'FINANCIAL',
  'VEHICLE',
  'PROPERTY',
  'SCHOLARSHIP',
  'FORM_FILLING',
  'GOVERNMENT_SCHEME',
];

export class ServiceQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @IsIn(SERVICE_CATEGORIES, {
    message: `category must be one of: ${SERVICE_CATEGORIES.join(', ')}`,
  })
  category?: ServiceCategory;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
