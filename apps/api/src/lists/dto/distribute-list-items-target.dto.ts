import { ArrayNotEmpty, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator'
import { DistributeFiltersBodyDto } from './distribute-filters.dto'

/**
 * 目標件数（割当件数）に基づく配布（:listId/items/distribute-target）
 * - assigneeUserIds と targetCounts は同じ順序・同じ長さで送る
 */
export class DistributeListItemsTargetDto extends DistributeFiltersBodyDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeUserIds!: string[]

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  @Min(0, { each: true })
  targetCounts!: number[]
}

