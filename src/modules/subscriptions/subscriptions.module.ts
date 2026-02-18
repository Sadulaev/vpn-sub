import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription, XuiServer } from '@database/entities';
import { ServerPoolsModule } from '@modules/server-pools';
import { XuiApiModule } from '@modules/xui-api';
import { UserBotModule } from '@modules/bot';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionPublicController } from './subscription-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, XuiServer]),
    ServerPoolsModule,
    XuiApiModule,
    forwardRef(() => UserBotModule),
  ],
  controllers: [SubscriptionsController, SubscriptionPublicController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
