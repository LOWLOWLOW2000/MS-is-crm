import { CallingList } from '../entities/calling-list.entity';

export interface ImportListResultDto {
  list: CallingList;
  importedCount: number;
  skippedCount: number;
}
