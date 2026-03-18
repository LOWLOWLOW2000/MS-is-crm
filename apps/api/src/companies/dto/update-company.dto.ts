import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class UpdateLegalEntityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  headOfficeAddress?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class UpdateEstablishmentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  type?: string;
}

class UpdatePersonaDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  departmentName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;
}

export class UpdateCompanyDto {
  @ValidateNested()
  @Type(() => UpdateLegalEntityDto)
  legalEntity!: UpdateLegalEntityDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateEstablishmentDto)
  establishments!: UpdateEstablishmentDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePersonaDto)
  personas!: UpdatePersonaDto[];
}

