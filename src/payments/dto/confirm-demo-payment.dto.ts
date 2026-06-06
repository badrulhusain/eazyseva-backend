import { IsEnum, IsString, IsUUID, Matches } from 'class-validator';
import { DemoPaymentResult } from '../enums/demo-payment-result.enum';

export class ConfirmDemoPaymentDto {
  @IsUUID()
  orderId: string;

  @IsString()
  @Matches(/^DEMO-TXN-\d{4}-[A-Z0-9]{7}$/, {
    message: 'demoTransactionId must match format DEMO-TXN-YYYY-XXXXXXX',
  })
  demoTransactionId: string;

  @IsEnum(DemoPaymentResult, {
    message: `result must be one of: ${Object.values(DemoPaymentResult).join(', ')}`,
  })
  result: DemoPaymentResult;
}
