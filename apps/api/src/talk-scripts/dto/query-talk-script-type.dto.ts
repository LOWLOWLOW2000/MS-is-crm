import { IsIn } from 'class-validator';

export class QueryTalkScriptTypeDto {
  @IsIn(['linear', 'branching'])
  type!: 'linear' | 'branching';
}
