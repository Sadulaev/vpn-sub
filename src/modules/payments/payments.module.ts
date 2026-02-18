import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentSession } from '@database/entities';
import { SubscriptionsModule } from '@modules/subscriptions';
import { PaymentsService } from './payments.service';
import { RobokassaService } from './robokassa.service';
import { PaymentsController } from './payments.controller';
import { PaymentNotificationService } from './payment-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentSession]),
    SubscriptionsModule,
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RobokassaService, PaymentNotificationService],
  exports: [PaymentsService, RobokassaService],
})
export class PaymentsModule {}

