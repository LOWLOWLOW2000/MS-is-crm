import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * 招待メール送信。SMTP 未設定時はログに URL を出すのみ（開発用）。
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendInvitationEmail(params: {
    to: string;
    inviteUrl: string;
    tenantLabel: string;
  }): Promise<void> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    const from = this.configService.get<string>('SMTP_FROM', 'noreply@localhost');

    const subject = `【IS CRM】${params.tenantLabel} への招待`;
    const text = `以下のリンクから参加登録を完了してください（有効期限: 3日・1回限り）。\n\n${params.inviteUrl}\n`;

    if (!host || !user || !pass) {
      this.logger.warn(`[招待メール・SMTP未設定] to=${params.to} url=${params.inviteUrl}`);
      return;
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: params.to,
      subject,
      text,
    });
  }
}
