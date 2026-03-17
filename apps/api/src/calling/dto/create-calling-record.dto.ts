import { IsBoolean, IsDateString, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { CallingResultType } from '../entities/calling-record.entity';

/** 汎用結果タイプのみ受け付ける（DIPの11種は保存しない。入力UIで汎用に変換して送る） */
const GENERIC_RESULT_VALUES: CallingResultType[] = [
  '担当者あり興味',
  '担当者あり不要',
  '不在',
  '番号違い',
  '断り',
  '折り返し依頼',
  '留守電',
  '資料送付',
  'アポ',
  'リスト除外',
  '不通',
];

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

  @IsIn(GENERIC_RESULT_VALUES)
  result!: CallingResultType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  memo?: string;

  @IsOptional()
  @IsDateString()
  nextCallAt?: string;
}

