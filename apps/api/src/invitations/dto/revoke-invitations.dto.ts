import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** 未使用招待の取り消し（行削除・トークン無効化） */
export class RevokeInvitationsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  invitationIds!: string[];
}
