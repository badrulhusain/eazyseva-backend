import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CustomerDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name: string;

  @Matches(/^[6-9]\d{9}$/, {
    message: 'phone must be a valid 10-digit Indian mobile number starting with 6–9',
  })
  phone: string;

  @IsDateString({}, { message: 'dateOfBirth must be a valid ISO 8601 date (e.g. 1990-05-15)' })
  dateOfBirth: string;

  @IsString()
  @MinLength(10)
  address: string;
}

export class DocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  // Must be a valid HTTPS URL — prevents raw strings from being stored as document references
  @IsUrl({ protocols: ['https'], require_protocol: true }, {
    message: 'url must be a valid HTTPS URL',
  })
  url: string;

  @IsString()
  @IsOptional()
  publicId?: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsString()
  @IsOptional()
  originalName?: string;

  @IsString()
  @IsOptional()
  resourceType?: string;

  @IsString()
  @IsOptional()
  format?: string;

  @IsNumber()
  @IsOptional()
  bytes?: number;
}

// Price fields are accepted for backwards-compat with the current frontend,
// but are IGNORED — the backend calculates all prices from the services table.
// Phase 4: remove this class entirely once the frontend no longer sends price.
export class PriceDto {
  @IsNumber()
  @IsOptional()
  governmentFee?: number;

  @IsNumber()
  @IsOptional()
  serviceCharge?: number;

  @IsNumber()
  @IsOptional()
  documentHandling?: number;

  @IsNumber()
  @IsOptional()
  total?: number;
}

export class CreateOrderDto {
  // Must match an active service slug in the services table.
  // Backend validates existence and fetches prices server-side.
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer: CustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  @IsOptional()
  documents?: DocumentDto[];

  // Optional: backend ignores these values and recalculates from service catalog.
  @ValidateNested()
  @Type(() => PriceDto)
  @IsOptional()
  price?: PriceDto;
}
