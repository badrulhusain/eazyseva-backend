import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { OrderStatus } from '../orders.types';

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

export class UpdateOrderStatusDto {
  @IsEnum(ORDER_STATUS_VALUES, {
    message: `status must be one of: ${ORDER_STATUS_VALUES.join(', ')}`,
  })
  status: OrderStatus;

  // Required when rejecting or requesting a correction; ignored otherwise.
  @ValidateIf(
    (o: UpdateOrderStatusDto) =>
      o.status === 'REJECTED' || o.status === 'CORRECTION_REQUESTED',
  )
  @IsString()
  @IsNotEmpty({
    message:
      'reason is required when rejecting an order or requesting a correction',
  })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'adminNote must not exceed 1000 characters' })
  adminNote?: string;
}
