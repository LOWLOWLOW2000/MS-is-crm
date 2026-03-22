import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { DistributeFiltersBodyDto } from './distribute-filters.dto';

/** 均等配布（フィルタは DistributeFiltersBodyDto と同一） */
export class DistributeListItemsDto extends DistributeFiltersBodyDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeUserIds!: string[];
}

