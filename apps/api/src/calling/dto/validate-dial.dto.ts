import { IsString, IsUrl, MaxLength } from 'class-validator';

export class ValidateDialDto {
  @IsString()
  @MaxLength(80)
  approvalId!: string;

  @IsUrl()
  targetUrl!: string;
}

