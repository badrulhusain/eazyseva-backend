import { IsEnum } from 'class-validator';
import type { OrderStatus } from '../orders.types';

export class UpdateOrderStatusDto {
  @IsEnum(['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'], {
    message: 'status must be one of: PENDING, PROCESSING, COMPLETED, REJECTED',
  })
  status: OrderStatus;
}
