import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectOrderDto {
  @IsString()
  @IsNotEmpty({ message: 'note is required when rejecting an order' })
  @MaxLength(500, { message: 'note must not exceed 500 characters' })
  note: string;
}
