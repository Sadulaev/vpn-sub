import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User, PaymentSession, BotState } from './entities';
import configuration from '../config';

@Module({
  imports: [
   TypeOrmModule.forRoot({
      type: 'postgres',
      host: configuration().database.host,
      port: configuration().database.port,
      username: configuration().database.username,
      password: configuration().database.password,
      database: configuration().database.database,
      entities: [PaymentSession, User, BotState],
      synchronize: true,
      autoLoadEntities: true,
    }),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}

