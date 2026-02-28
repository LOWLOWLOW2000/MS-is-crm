/**
 * Phase2: リスト生成リクエスト作成
 * input はエリアID・業種ID・キーワードID等を保持するJSON（将来拡張）
 */
export interface CreateListGenerationRequestDto {
  assignedToEmail: string;
  input: {
    areaIds?: string[];
    industryIds?: string[];
    keywordIds?: string[];
    freeText?: string;
    [key: string]: unknown;
  };
}
