import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Создаём необходимые директории
  const sessionsDir = join(process.cwd(), 'sessions');
  const assetsDir = join(process.cwd(), 'assets');

  if (!existsSync(sessionsDir)) {
    mkdirSync(sessionsDir, { recursive: true });
    logger.log('Created sessions directory');
  }

  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
    logger.log('Created assets directory');
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Глобальная обработка ошибок
  process.on('unhandledRejection', (reason: any) => {
    logger.error(`Unhandled Rejection: ${reason?.stack || reason}`);
  });

  process.on('uncaughtException', (error: any) => {
    logger.error(`Uncaught Exception: ${error?.stack || error}`);
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') || 3000;

  await app.listen(port);

  logger.log(`🚀 Application is running on port ${port}`);
  logger.log(`📊 Environment: ${configService.get<string>('app.nodeEnv')}`);
}

bootstrap();

