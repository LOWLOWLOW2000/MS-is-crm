import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  NotFoundException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { GoogleAuthProfile } from './strategies/google.strategy';

interface JwtRequest extends Request {
  user: JwtPayload;
}

interface GoogleRequest extends Request {
  user: GoogleAuthProfile;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto): Promise<AuthResponseDto> {
    return this.authService.loginWithPassword(loginDto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponseDto> {
    try {
      return await this.authService.refreshTokens(dto.refreshToken);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new InternalServerErrorException('トークン更新に失敗しました');
    }
  }

  @Post('google/exchange')
  async loginWithGoogleExchange(
    @Body() googleLoginDto: GoogleLoginDto,
  ): Promise<AuthResponseDto> {
    // #region agent log
    fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H3',location:'apps/api/src/auth/auth.controller.ts:googleExchange:entry',message:'google exchange entry',data:{hasEmail:typeof googleLoginDto.email === 'string' && googleLoginDto.email.length>0,hasName:typeof googleLoginDto.name === 'string' && googleLoginDto.name.length>0},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    try {
      const result = await this.authService.loginWithGoogle({
        email: googleLoginDto.email,
        name: googleLoginDto.name ?? googleLoginDto.email,
      });
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H3',location:'apps/api/src/auth/auth.controller.ts:googleExchange:success',message:'google exchange success',data:{tenantId:result.user.tenantId,userIdPresent:typeof result.user.id === 'string' && result.user.id.length>0},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return result
    } catch (e) {
      // #region agent log
      fetch('http://127.0.0.1:7788/ingest/76c3a999-78a8-4303-8f64-4e64935f7100',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3c49aa'},body:JSON.stringify({sessionId:'3c49aa',runId:'pre-fix',hypothesisId:'H3',location:'apps/api/src/auth/auth.controller.ts:googleExchange:error',message:'google exchange error',data:{errorName:e instanceof Error ? e.name : '<non-error>',errorMessage:e instanceof Error ? e.message : '<non-error>'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw e
    }
  }

  /** NextAuth（Microsoft / Azure AD）用：Google と同じペイロード */
  @Post('microsoft/exchange')
  async loginWithMicrosoftExchange(
    @Body() dto: GoogleLoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle({
      email: dto.email,
      name: dto.name ?? dto.email,
    });
  }

  /** 初回：企業テナント作成＋企業管理者＋ディレクター */
  @Post('register-company')
  async registerCompany(@Body() dto: RegisterCompanyDto): Promise<AuthResponseDto> {
    return this.authService.registerCompany(dto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  startGoogleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: GoogleRequest, @Res() res: Response): Promise<void> {
    const result = await this.authService.loginWithGoogle(req.user);
    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
    const redirectUrl = new URL('/login', webBaseUrl);

    redirectUrl.searchParams.set('token', result.accessToken);
    redirectUrl.searchParams.set('tenantId', result.user.tenantId);
    redirectUrl.searchParams.set('role', result.user.role);
    if (result.refreshToken) {
      redirectUrl.searchParams.set('refreshToken', result.refreshToken);
    }
    if (result.refreshExpiresAt) {
      redirectUrl.searchParams.set('refreshExpiresAt', result.refreshExpiresAt);
    }

    res.redirect(redirectUrl.toString());
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: JwtRequest) {
    return this.authService.getProfile(req.user);
  }

  /** メール+パスワード利用者向けパスワード変更（変更後は refresh が失効） */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Req() req: JwtRequest, @Body() dto: ChangePasswordDto) {
    try {
      return await this.authService.changePassword(req.user, dto);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      if (error instanceof UnauthorizedException) throw error;
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('パスワード変更に失敗しました');
    }
  }
}
