import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TelegrafModule } from 'nestjs-telegraf';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as LocalSession from 'telegraf-session-local';
import configuration from './config';

// Модули
import { PaymentsModule } from '@modules/payments';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { UserBotModule } from '@modules/bot/user-bot.module';
import { XuiApiModule } from '@modules/xui-api';
import { ClientsModule } from '@modules/clients';
import { ServerPoolsModule } from '@modules/server-pools';
import { SubscriptionsModule } from '@modules/subscriptions';

// Interceptors
import { TelegrafErrorInterceptor } from '@common/interceptors/telegraf-error.interceptor';
import { TypeOrmModule } from '@nestjs/typeorm';

// Sessions для ботов
const userBotSessions = new LocalSession({ database: 'sessions/user_bot.json' });

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

    // База данных
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: configuration().database.host,
      port: configuration().database.port,
      username: configuration().database.username,
      password: configuration().database.password,
      database: configuration().database.database,
      synchronize: true,
      autoLoadEntities: true,
    }),

    // Функциональные модули
    XuiApiModule,
    ClientsModule,
    ServerPoolsModule,
    SubscriptionsModule,
    PaymentsModule,
    GoogleSheetsModule,
    UserBotModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TelegrafErrorInterceptor,
    },
  ],
})
export class AppModule {}

