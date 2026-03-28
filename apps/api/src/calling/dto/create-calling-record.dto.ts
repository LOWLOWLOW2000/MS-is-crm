import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CALLING_RESULT_VALUES, type CallingResultType } from '../calling-result-canonical';

/** POST 時は正規名 11 種のみ受け付ける */
const RESULTS: CallingResultType[] = [...CALLING_RESULT_VALUES];

export class CreateCallingRecordDto {
  @IsString()
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MaxLength(40)
  companyPhone!: string;

  @IsString()
  @MaxLength(200)
  companyAddress!: string;

  @IsUrl()
  targetUrl!: string;

  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsDateString()
  approvedAt?: string;

  @IsIn(RESULTS)
  result!: CallingResultType;

  /** 指定時は同一テナントの ListItem を架電結果で更新（★架電ルームと配布フィルタの整合） */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  listItemId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string;

  @IsOptional()
  @IsDateString()
  nextCallAt?: string;
}
