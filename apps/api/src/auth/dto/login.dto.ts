import { IsEmail, IsString, MinLength } from 'class-validator';

/** ログイン用。長さ要件は新規登録（RegisterCompanyDto 等）側で行う */
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1, { message: 'パスワードを入力してください' })
  password!: string;
}
