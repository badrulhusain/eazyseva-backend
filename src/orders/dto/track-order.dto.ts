import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class TrackOrderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(/^ES-\d{4}-\d{5,}$/i, {
    message: 'orderNumber must be a valid EzySeva order number',
  })
  orderNumber: string;

  @Matches(/^[6-9]\d{9}$/, {
    message:
      'phone must be a valid 10-digit Indian mobile number starting with 6–9',
  })
  phone: string;
}
