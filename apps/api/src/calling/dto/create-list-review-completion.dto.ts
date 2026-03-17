import { IsString, IsUrl, MaxLength } from 'class-validator'

export class CreateListReviewCompletionDto {
  @IsString()
  @MaxLength(120)
  companyName!: string

  @IsUrl()
  targetUrl!: string
}
