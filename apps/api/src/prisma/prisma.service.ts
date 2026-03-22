import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma クライアントのラッパー。
 * 全クエリで tenantId フィルタを忘れないこと。
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    const adapter = new PrismaPg({ connectionString })
    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    })
  }

  onModuleInit = async (): Promise<void> => {
    await this.$connect();
  };

  onModuleDestroy = async (): Promise<void> => {
    await this.$disconnect();
  };
}
