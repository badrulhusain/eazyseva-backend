import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { OrderStatus } from '../orders.types';

export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'REJECTED'], {
    message: 'status must be one of: PENDING, ACCEPTED, PROCESSING, COMPLETED, REJECTED',
  })
  status: OrderStatus;

  // Required when rejecting; ignored for any other status transition.
  @ValidateIf((o: UpdateOrderStatusDto) => o.status === 'REJECTED')
  @IsString()
  @IsNotEmpty({ message: 'reason is required when rejecting an order' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'adminNote must not exceed 1000 characters' })
  adminNote?: string;
}
