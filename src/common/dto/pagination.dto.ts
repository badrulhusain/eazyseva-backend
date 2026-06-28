import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { OrderStatus } from '../../orders/orders.types';
import type { PaymentStatus } from '../../orders/orders.types';

const ORDER_STATUS_VALUES: OrderStatus[] = [
  'PENDING',
  'UNDER_REVIEW',
  'ACCEPTED',
  'CORRECTION_REQUESTED',
  'PROCESSING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

const PAYMENT_STATUS_VALUES: PaymentStatus[] = [
  'NOT_PAID',
  'PAYMENT_PENDING',
  'PAID',
  'FAILED',
];

export class PaginationDto {
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
  @IsEnum(ORDER_STATUS_VALUES, {
    message: `status must be one of: ${ORDER_STATUS_VALUES.join(', ')}`,
  })
  status?: OrderStatus;

  @IsOptional()
  @IsEnum(PAYMENT_STATUS_VALUES, {
    message: `paymentStatus must be one of: ${PAYMENT_STATUS_VALUES.join(', ')}`,
  })
  paymentStatus?: PaymentStatus;

  // Free-text search across order number / customer name / customer phone.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateFrom must be a valid ISO 8601 date' })
  dateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'dateTo must be a valid ISO 8601 date' })
  dateTo?: string;
}
