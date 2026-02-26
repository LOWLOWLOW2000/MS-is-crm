import { IsString, MaxLength } from 'class-validator';

export class CreateHelpRequestDto {
  @IsString()
  @MaxLength(120)
  companyName!: string;

  @IsString()
  @MaxLength(80)
  scriptTab!: string;
}

