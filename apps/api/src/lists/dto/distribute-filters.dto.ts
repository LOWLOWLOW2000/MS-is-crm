import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString } from 'class-validator';

/** 配布対象の進捗（ListItem.status ベース） */
export const DISTRIBUTE_CALL_PROGRESS = ['unstarted', 'contacted', 'any'] as const;
export type DistributeCallProgress = (typeof DISTRIBUTE_CALL_PROGRESS)[number];

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

  @IsOptional()
  @IsIn(DISTRIBUTE_CALL_PROGRESS)
  callProgress?: DistributeCallProgress;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsIn(['A', 'B', 'C'], { each: true })
  aiTiers?: ('A' | 'B' | 'C')[];
}
