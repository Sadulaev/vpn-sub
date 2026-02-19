import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubscriptionsModule } from '@modules/subscriptions';
import { PaymentsModule } from '@modules/payments';
import { UserBotModule } from '@modules/bot';

@Module({
  imports: [
    SubscriptionsModule, 
    PaymentsModule,
    forwardRef(() => UserBotModule),
  ],
  providers: [TasksService],
})
export class TasksModule {}
