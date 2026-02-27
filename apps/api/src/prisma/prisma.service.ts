import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma クライアントのラッパー。
 * 全クエリで tenantId フィルタを忘れないこと。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  onModuleInit = async (): Promise<void> => {
    await this.$connect();
  };

  onModuleDestroy = async (): Promise<void> => {
    await this.$disconnect();
  };
}
