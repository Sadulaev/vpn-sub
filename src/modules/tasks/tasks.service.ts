import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from '@modules/subscriptions';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Обработка истёкших подписок
   * Выполняется каждый день в 03:00
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleExpiredSubscriptions() {
    this.logger.log('Running scheduled task: Process expired subscriptions');

    try {
      const result = await this.subscriptionsService.processExpiredSubscriptions();

      this.logger.log(
        `Task completed: ${result.expired} subscriptions expired, ${result.clientsRemoved.length} clients removed from servers`,
      );
    } catch (error) {
      this.logger.error('Error processing expired subscriptions:', error);
    }
  }

  /**
   * Дополнительная проверка каждые 6 часов
   * Для подстраховки, если что-то пропустили ночью
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async handleExpiredSubscriptionsBackup() {
    this.logger.log('Running backup task: Process expired subscriptions');

    try {
      const result = await this.subscriptionsService.processExpiredSubscriptions();

      if (result.expired > 0) {
        this.logger.log(
          `Backup task found: ${result.expired} subscriptions expired, ${result.clientsRemoved.length} clients removed`,
        );
      }
    } catch (error) {
      this.logger.error('Error in backup task:', error);
    }
  }
}
