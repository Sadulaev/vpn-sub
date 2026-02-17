import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription, XuiServer } from '@database/entities';
import { ClientsModule } from '@modules/clients';
import { ServerPoolsModule } from '@modules/server-pools';
import { XuiApiModule } from '@modules/xui-api';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionPublicController } from './subscription-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, XuiServer]),
    ClientsModule,
    ServerPoolsModule,
    XuiApiModule,
  ],
  controllers: [SubscriptionsController, SubscriptionPublicController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
