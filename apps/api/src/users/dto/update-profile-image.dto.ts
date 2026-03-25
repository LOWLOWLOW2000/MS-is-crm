import { IsString, MaxLength } from 'class-validator'

/** プロフ写真アップロード（MVP: dataURL文字列をそのまま保存） */
export class UpdateProfileImageDto {
  @IsString()
  @MaxLength(2000000)
  profileImageUrl!: string
}

