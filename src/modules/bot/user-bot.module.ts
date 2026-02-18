import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@database/entities';
import { PaymentsModule } from '@modules/payments';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { SubscriptionsModule } from '@modules/subscriptions';
import { UserBotService } from './services/user-bot.service';
import { UserBotUpdate } from './user-bot.update';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    forwardRef(() => PaymentsModule),
    GoogleSheetsModule,
    forwardRef(() => SubscriptionsModule),
  ],
  providers: [UserBotService, UserBotUpdate],
  exports: [UserBotService],
})
export class UserBotModule {}

