import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SubscriptionsModule } from '@modules/subscriptions';

@Module({
  imports: [SubscriptionsModule],
  providers: [TasksService],
})
export class TasksModule {}
