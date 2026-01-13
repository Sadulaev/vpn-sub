import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as LocalSession from 'telegraf-session-local';
import configuration from './config';

// Модули
import { DatabaseModule } from '@database/database.module';
import { VpnServersModule } from '@modules/vpn-servers';
import { PaymentsModule } from '@modules/payments';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { UserBotModule } from '@modules/bot/user-bot.module';
import { AdminBotModule } from '@modules/admin-bot';

// Interceptors
import { TelegrafErrorInterceptor } from '@common/interceptors/telegraf-error.interceptor';

// Sessions для ботов
const userBotSessions = new LocalSession({ database: 'sessions/user_bot.json' });
const adminBotSessions = new LocalSession({ database: 'sessions/admin_bot.json' });

@Module({
  imports: [
    // Конфигурация
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),

    // Пользовательский бот
    TelegrafModule.forRoot({
      botName: 'userBot',
      token: configuration().telegram.userBotToken,
      middlewares: [userBotSessions.middleware()],
      include: [UserBotModule],
    }),

    // Админ-бот
    TelegrafModule.forRoot({
      botName: 'adminBot',
      token: configuration().telegram.adminBotToken,
      middlewares: [adminBotSessions.middleware()],
      include: [AdminBotModule],
    }),

    // База данных
    DatabaseModule,

    // Функциональные модули
    VpnServersModule,
    PaymentsModule,
    GoogleSheetsModule,
    UserBotModule,
    AdminBotModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TelegrafErrorInterceptor,
    },
  ],
})
export class AppModule {}

