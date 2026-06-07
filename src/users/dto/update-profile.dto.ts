import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  full_name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[+]?[0-9]{10,15}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;
}
