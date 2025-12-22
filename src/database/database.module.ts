import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, PaymentSession, BotState } from './entities';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [User, PaymentSession, BotState],
        synchronize: configService.get<string>('app.nodeEnv') === 'development',
        logging: configService.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    TypeOrmModule.forFeature([User, PaymentSession, BotState]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

