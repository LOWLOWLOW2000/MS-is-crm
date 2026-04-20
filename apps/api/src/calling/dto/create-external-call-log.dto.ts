import { IsBoolean, IsDateString, IsIn, IsObject, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator'
import { CALLING_RESULT_VALUES, type CallingResultType } from '../calling-result-canonical'

const RESULTS: CallingResultType[] = [...CALLING_RESULT_VALUES]

export class CreateExternalCallLogDto {
  @IsString()
  @MaxLength(40)
  listItemId!: string

  @IsString()
  @MaxLength(40)
  clientRowId!: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  clientRowNo?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  clientSourceName?: string

  @IsString()
  @MaxLength(120)
  companyName!: string

  @IsString()
  @MaxLength(40)
  companyPhone!: string

  @IsString()
  @MaxLength(200)
  companyAddress!: string

  @IsUrl()
  targetUrl!: string

  @IsIn(RESULTS)
  result!: CallingResultType

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string

  @IsOptional()
  @IsObject()
  structuredReport?: Record<string, unknown>

  @IsOptional()
  @IsDateString()
  nextCallAt?: string

  @IsOptional()
  @IsUrl()
  recordingUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  recordingLocalPath?: string

  @IsOptional()
  @IsUrl()
  transcriptUrl?: string

  @IsOptional()
  @IsString()
  @MaxLength(300)
  transcriptLocalPath?: string

  @IsOptional()
  @IsBoolean()
  containsPII?: boolean

  @IsOptional()
  @IsBoolean()
  trainingEligible?: boolean

  @IsOptional()
  @IsString()
  transcriptionText?: string

  @IsOptional()
  @IsDateString()
  transcribedAt?: string
}

