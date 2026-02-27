import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateZoomDialSessionDto {
  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsUrl(
    {
      require_protocol: true,
    },
    {
      message: 'targetUrl は有効なURLを指定してください',
    },
  )
  targetUrl!: string;
}

export interface ZoomDialSessionResultDto {
  provider: 'zoom';
  meetingId: string;
  topic: string;
  joinUrl: string;
  startUrl: string;
  scheduledAt: string;
  isFallback: boolean;
}
