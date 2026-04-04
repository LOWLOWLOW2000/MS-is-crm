import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator'

export class AcceptMockInvitationDto {
  @IsString()
  @MinLength(32)
  token!: string

  @IsEmail()
  email!: string

  @IsOptional()
  @ValidateIf((o: AcceptMockInvitationDto) => o.password != null && o.password !== '')
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上で指定してください' })
  password?: string

  @IsOptional()
  @IsString()
  name?: string
}

