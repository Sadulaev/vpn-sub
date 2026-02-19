import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubscriptionsModule } from '@modules/subscriptions';
import { PaymentsModule } from '@modules/payments';

@Module({
  imports: [SubscriptionsModule, PaymentsModule],
  providers: [TasksService],
})
export class TasksModule {}
