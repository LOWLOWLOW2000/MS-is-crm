import { IsBoolean } from 'class-validator';

export class UpdateCallingSettingsDto {
  @IsBoolean()
  humanApprovalEnabled!: boolean;
}
