import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

/** 配布対象の進捗（ListItem.status ベース） */
export const DISTRIBUTE_CALL_PROGRESS = ['unstarted', 'contacted', 'any'] as const;
export type DistributeCallProgress = (typeof DISTRIBUTE_CALL_PROGRESS)[number];

/** 条件付き配布で使うステータス（ListItem.status） */
export const DISTRIBUTE_LIST_ITEM_STATUSES = [
  '担当者あり興味',
  '担当者あり不要',
  '不在',
  '番号違い',
  '断り',
  '折り返し依頼',
  '留守電',
  '資料送付',
  'アポ',
  'リスト除外',
  '不通',
] as const;
export type DistributeListItemStatus = (typeof DISTRIBUTE_LIST_ITEM_STATUSES)[number];

/** POST 配布・プレビュー共通のフィルタ（assignee 以外） */
export class DistributeFiltersBodyDto {
  @IsOptional()
  @IsString()
  addressContains?: string;

  @IsOptional()
  @IsString()
  cityContains?: string;

  @IsOptional()
  @IsString()
  industryTagContains?: string;

  /** 業種マスタ名の複数選択（いずれかに industryTag が部分一致） */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  industryNames?: string[];

  @IsOptional()
  @IsIn(DISTRIBUTE_CALL_PROGRESS)
  callProgress?: DistributeCallProgress;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsIn(DISTRIBUTE_LIST_ITEM_STATUSES, { each: true })
  statuses?: DistributeListItemStatus[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['A', 'B', 'C'], { each: true })
  aiTiers?: ('A' | 'B' | 'C')[];
}
