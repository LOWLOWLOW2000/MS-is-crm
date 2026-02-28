export interface GenerateListInput {
  areaId: string;
  industryId: string;
  keywordIds: string[];
  limit?: number;
}

export class GenerateListDto {
  input!: GenerateListInput;
  assigneeEmail!: string;
  // 任意。未指定の場合はマスタ名から自動生成
  listName?: string;
}

