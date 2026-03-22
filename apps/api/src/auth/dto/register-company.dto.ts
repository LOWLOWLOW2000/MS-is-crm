import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

/** 初回企業作成（企業管理者＋ディレクターロール）。パスワードは任意（OAuth のみの場合は未設定可） */
export class RegisterCompanyDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @ValidateIf((o: RegisterCompanyDto) => o.password != null && o.password !== '')
  @IsString()
  @MinLength(8, { message: 'パスワードは8文字以上で指定してください' })
  password?: string;

  @IsString()
  name!: string;

  @IsString()
  companyName!: string;

  @IsString()
  headOfficeAddress!: string;

  @IsString()
  headOfficePhone!: string;

  @IsString()
  representativeName!: string;
}
