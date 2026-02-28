export interface ListAdviceRequestDto {
  // ディレクターが相談したい内容（自然文）。将来的にプロンプト解釈へ拡張予定。
  question: string;
}

export interface ListAdviceResponseDto {
  advice: string;
  suggestedActions: {
    type: 'generate' | 'assign_existing';
    title: string;
    payload: Record<string, unknown>;
  }[];
}

