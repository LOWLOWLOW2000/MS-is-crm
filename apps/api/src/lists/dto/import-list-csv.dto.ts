import { IsOptional, IsString, MinLength } from 'class-validator';

export class ImportListCsvDto {
  @IsString()
  @MinLength(1)
  csvText!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
