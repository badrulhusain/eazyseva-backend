import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { OrderStatus } from '../../orders/orders.types';

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
  @IsEnum(['PENDING', 'ACCEPTED', 'PROCESSING', 'COMPLETED', 'REJECTED'], {
    message: 'status must be one of: PENDING, ACCEPTED, PROCESSING, COMPLETED, REJECTED',
  })
  status?: OrderStatus;
}
