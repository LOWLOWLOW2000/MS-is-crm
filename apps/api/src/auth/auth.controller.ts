import {
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
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
    return this.authService.loginWithGoogle({
      email: googleLoginDto.email,
      name: googleLoginDto.name ?? googleLoginDto.email,
    });
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
}
