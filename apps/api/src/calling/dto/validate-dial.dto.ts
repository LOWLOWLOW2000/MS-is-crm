import { IsString, IsUrl, MaxLength } from 'class-validator'

/** 発信可否チェック。listReviewCompletionId = リスト精査終了ID */
export class ValidateDialDto {
  @IsString()
  @MaxLength(80)
  listReviewCompletionId!: string

  @IsUrl()
  targetUrl!: string
}

