import { IsIn, IsOptional, IsString } from 'class-validator';

export class RecallListItemsDto {
  @IsOptional()
  @IsString()
  assigneeUserId?: string;

  @IsOptional()
  @IsIn(['all', 'unstartedOnly', 'callingOnly'])
  mode?: 'all' | 'unstartedOnly' | 'callingOnly';
}

