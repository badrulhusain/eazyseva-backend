import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RequestCorrectionDto {
  @IsString()
  @IsNotEmpty({ message: 'note is required when requesting a correction' })
  @MaxLength(500, { message: 'note must not exceed 500 characters' })
  note: string;
}
