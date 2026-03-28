import { IsBoolean, IsIn, IsObject, IsOptional } from 'class-validator';

export class UpdateCallingSettingsDto {
  @IsOptional()
  @IsBoolean()
  humanApprovalEnabled?: boolean;

  @IsOptional()
  @IsIn(['mock', 'zoom_embed', 'external_url', 'webhook'])
  callProviderKind?: string;

  @IsOptional()
  @IsObject()
  callProviderConfig?: Record<string, unknown>;
}
