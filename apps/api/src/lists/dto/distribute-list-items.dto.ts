import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class DistributeListItemsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  assigneeUserIds!: string[];
}

