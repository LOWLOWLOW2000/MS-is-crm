import { IsIn } from 'class-validator';

export class UpdateListItemStatusDto {
  @IsIn(['unstarted', 'calling', 'done', 'excluded'])
  status!: 'unstarted' | 'calling' | 'done' | 'excluded';
}

