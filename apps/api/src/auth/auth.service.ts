import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole } from '../common/enums/user-role.enum';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { demoUsers } from './constants/demo-users';
import { LoginDto } from './dto/login.dto';
import { AuthUser } from './entities/auth-user.entity';
import { GoogleAuthProfile } from './strategies/google.strategy';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  private toPayload(user: AuthUser): JwtPayload {
    return {
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    };
  }

  private sign(user: AuthUser): string {
    return this.jwtService.sign(this.toPayload(user));
  }

  private toResponse(user: AuthUser): {
    accessToken: string;
    user: {
      id: string;
      tenantId: string;
      role: UserRole;
      email: string;
      name: string;
    };
  } {
    return {
      accessToken: this.sign(user),
      user: {
        id: user.id,
        tenantId: user.tenantId,
        role: user.role,
        email: user.email,
        name: user.name,
      },
    };
  }

  async loginWithPassword(loginDto: LoginDto) {
    const user = demoUsers.find((candidate) => candidate.email === loginDto.email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('メールまたはパスワードが正しくありません');
    }

    const isMatched = await bcrypt.compare(loginDto.password, user.passwordHash);

    if (!isMatched) {
      throw new UnauthorizedException('メールまたはパスワードが正しくありません');
    }

    return this.toResponse(user);
  }

  loginWithGoogle(profile: GoogleAuthProfile) {
    const existing = demoUsers.find((user) => user.email === profile.email);

    if (existing) {
      return this.toResponse(existing);
    }

    const tenantId = this.resolveTenantId(profile.email);
    const newUser: AuthUser = {
      id: `user-google-${Date.now()}`,
      tenantId,
      role: UserRole.IsMember,
      email: profile.email,
      name: profile.name,
    };

    demoUsers.push(newUser);

    return this.toResponse(newUser);
  }

  getProfile(payload: JwtPayload) {
    const user = demoUsers.find((candidate) => candidate.id === payload.sub);

    if (!user) {
      throw new NotFoundException('ユーザーが見つかりません');
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
      name: user.name,
    };
  }

  private resolveTenantId(email: string): string {
    const [, domain] = email.split('@');

    if (!domain) {
      return 'tenant-demo-01';
    }

    return `tenant-${domain.replace(/\./g, '-')}`;
  }
}
