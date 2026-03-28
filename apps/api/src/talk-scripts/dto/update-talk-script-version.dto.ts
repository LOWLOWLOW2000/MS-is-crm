import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTalkScriptVersionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  label?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}
