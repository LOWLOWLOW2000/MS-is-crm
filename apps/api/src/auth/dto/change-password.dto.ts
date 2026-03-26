import { IsString, MinLength } from 'class-validator'

/** メールログイン利用者向けパスワード変更 */
export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string

  @IsString()
  @MinLength(8)
  newPassword!: string
}
