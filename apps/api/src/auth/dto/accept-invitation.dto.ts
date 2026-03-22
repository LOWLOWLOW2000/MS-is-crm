import { IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class AcceptInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string;

  @IsOptional()
  @ValidateIf((o: AcceptInvitationDto) => o.password != null && o.password !== '')
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上で指定してください' })
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;
}
