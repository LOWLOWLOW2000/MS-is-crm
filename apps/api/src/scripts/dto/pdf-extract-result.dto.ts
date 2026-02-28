/**
 * Phase2: PDF取り込み（スタブ）のレスポンス。実際のテキスト抽出は Python 等に任せる想定。
 */
export interface PdfExtractResultDto {
  text: string;
  suggestedTabName: string;
  pageCount?: number;
}
