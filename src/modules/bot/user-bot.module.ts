import { Module, forwardRef } from '@nestjs/common';
import { PaymentsModule } from '@modules/payments';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { SubscriptionsModule } from '@modules/subscriptions';
import { ServerPoolsModule } from '@modules/server-pools';
import { XuiApiModule } from '@modules/xui-api';
import { UserBotService } from './services/user-bot.service';
import { UserBotUpdate } from './user-bot.update';

@Module({
  imports: [
    forwardRef(() => PaymentsModule),
    GoogleSheetsModule,
    forwardRef(() => SubscriptionsModule),
    forwardRef(() => ServerPoolsModule),
    XuiApiModule,
  ],
  providers: [UserBotService, UserBotUpdate],
  exports: [UserBotService],
})
export class UserBotModule {}

