import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  @MinLength(10)
  address: string;
}

export class DocumentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsString()
  @IsOptional()
  publicId?: string;
}

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
  @IsPositive()
  total: number;
}

export class CreateOrderDto {
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

  @ValidateNested()
  @Type(() => PriceDto)
  price: PriceDto;
}
