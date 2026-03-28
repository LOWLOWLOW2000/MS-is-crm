import { IsIn, IsObject, IsString, MinLength } from 'class-validator';

export class CreateTalkScriptVersionDto {
  @IsIn(['linear', 'branching'])
  type!: 'linear' | 'branching';

  @IsString()
  @MinLength(1)
  label!: string;

  @IsObject()
  content!: Record<string, unknown>;
}
