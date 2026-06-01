import { IsEnum, IsUUID } from 'class-validator';
import { DemoPaymentMethod } from '../enums/demo-payment-method.enum';

export class StartDemoPaymentDto {
  @IsUUID()
  orderId: string;

  @IsEnum(DemoPaymentMethod, {
    message: `method must be one of: ${Object.values(DemoPaymentMethod).join(', ')}`,
  })
  method: DemoPaymentMethod;
}
