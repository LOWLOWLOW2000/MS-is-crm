import './preload-env'
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const bootstrap = async () => {
  const dbUrl = process.env.DATABASE_URL
  if (process.env.NODE_ENV !== 'production' && dbUrl) {
    const hostMatch = dbUrl.match(/@([^/?]+)/)
    if (hostMatch) {
      Logger.log(`DATABASE_URL 接続先（ホストのみ）: ${hostMatch[1]}`, 'Bootstrap')
    }
  }

  const app = await NestFactory.create(AppModule);

  /** Next の dev が 3002/3003 に逃げる場合や 127.0.0.1 利用に対応 */
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) {
        cb(null, true);
        return;
      }
      const ok = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      cb(null, ok);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
};

void bootstrap();
