import { IsOptional, IsString } from 'class-validator';

export class CallWebhookEventDto {
  @IsString()
  event!: string;

  @IsOptional()
  @IsString()
  recordingUrl?: string;
}
