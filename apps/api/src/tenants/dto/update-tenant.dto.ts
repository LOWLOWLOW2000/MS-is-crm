import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * 企業管理画面: テナントプロフィールと AM 割当の更新
 */
export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  headOfficeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  headOfficePhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  representativeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  projectDisplayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  accountStatus?: string;

  /** 同一テナント内の User.id。企業管理者が AM を付与する対象 */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accountManagerUserIds?: string[];
}
