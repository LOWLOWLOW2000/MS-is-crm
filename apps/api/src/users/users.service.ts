import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../common/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  getUsers = async (user: JwtPayload) => {
    const rows = await this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        tenantId: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    return rows;
  };
}

