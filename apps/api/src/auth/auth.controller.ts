import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { AuthResponseDto } from './dto/auth-response.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
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

  @Post('google/exchange')
  async loginWithGoogleExchange(
    @Body() googleLoginDto: GoogleLoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.loginWithGoogle({
      email: googleLoginDto.email,
      name: googleLoginDto.name ?? googleLoginDto.email,
    });
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  startGoogleLogin(): void {}

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleCallback(@Req() req: GoogleRequest, @Res() res: Response): void {
    const result = this.authService.loginWithGoogle(req.user);
    const webBaseUrl = this.configService.get<string>('WEB_BASE_URL', 'http://localhost:3000');
    const redirectUrl = new URL('/login', webBaseUrl);

    redirectUrl.searchParams.set('token', result.accessToken);
    redirectUrl.searchParams.set('tenantId', result.user.tenantId);
    redirectUrl.searchParams.set('role', result.user.role);

    res.redirect(redirectUrl.toString());
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() req: JwtRequest) {
    return this.authService.getProfile(req.user);
  }
}
