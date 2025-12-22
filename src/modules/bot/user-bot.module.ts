import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@database/entities';
import { PaymentsModule } from '@modules/payments';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { UserBotService } from './services/user-bot.service';
import { UserBotUpdate } from './user-bot.update';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PaymentsModule,
    GoogleSheetsModule,
  ],
  providers: [UserBotService, UserBotUpdate],
  exports: [UserBotService],
})
export class UserBotModule {}

