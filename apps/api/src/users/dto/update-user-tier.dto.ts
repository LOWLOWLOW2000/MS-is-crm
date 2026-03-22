import { IsIn } from 'class-validator';

/** 管理画面の BOX 相当。サーバー側で既存の保護ロールを維持しつつ director / is_member を切り替える */
export class UpdateUserTierDto {
  @IsIn(['director', 'is'])
  box!: 'director' | 'is';
}
