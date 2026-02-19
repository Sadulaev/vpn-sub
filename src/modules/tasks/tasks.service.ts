import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SubscriptionsService } from '@modules/subscriptions';
import { PaymentsService } from '@modules/payments';
import { UserBotService } from '@modules/bot/services/user-bot.service';
import { SubscriptionStatus } from '@database/entities';
import { LessThan, MoreThan } from 'typeorm';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => UserBotService))
    private readonly userBotService: UserBotService,
  ) {}

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

      // Удаляем истекшие payment sessions
      const deletedSessions = await this.paymentsService.deleteExpiredSessions();
      if (deletedSessions > 0) {
        this.logger.log(`Deleted ${deletedSessions} expired payment sessions`);
      }
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

      // Удаляем истекшие payment sessions
      const deletedSessions = await this.paymentsService.deleteExpiredSessions();
      if (deletedSessions > 0) {
        this.logger.log(`Deleted ${deletedSessions} expired payment sessions`);
      }
    } catch (error) {
      this.logger.error('Error in backup task:', error);
    }
  }

  /**
   * Уведомление о скором окончании подписки
   * Выполняется каждый день в 10:00
   */
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async notifyExpiringSubscriptions() {
    this.logger.log('Running scheduled task: Notify expiring subscriptions');

    try {
      // Находим подписки, которые истекают в течение следующих 24 часов
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const dayAfterTomorrow = new Date();
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

      const expiringSubscriptions = await this.subscriptionsService['subscriptionRepo'].find({
        where: {
          status: SubscriptionStatus.ACTIVE,
          endDate: LessThan(dayAfterTomorrow),
        },
      });

      let notified = 0;
      let failed = 0;

      for (const subscription of expiringSubscriptions) {
        if (!subscription.telegramId) {
          continue;
        }

        const success = await this.userBotService.notifySubscriptionExpiringSoon(
          subscription.telegramId,
          subscription.endDate
        );

        if (success) {
          notified++;
        } else {
          failed++;
        }

        // Небольшая задержка между уведомлениями
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log(
        `Expiring notifications sent: ${notified} successful, ${failed} failed out of ${expiringSubscriptions.length} subscriptions`
      );
    } catch (error) {
      this.logger.error('Error sending expiring notifications:', error);
    }
  }

  /**
   * Зазывающие сообщения для неактивных пользователей
   * Выполняется каждый день в 18:00
   */
  @Cron(CronExpression.EVERY_DAY_AT_6PM)
  async notifyInactiveUsers() {
    this.logger.log('Running scheduled task: Notify inactive users');

    try {
      // Находим все истекшие и отмененные подписки
      const inactiveSubscriptions = await this.subscriptionsService['subscriptionRepo'].find({
        where: [
          { status: SubscriptionStatus.EXPIRED },
          { status: SubscriptionStatus.CANCELLED },
        ],
        order: { updatedAt: 'DESC' },
      });

      // Группируем по telegramId и берем только последнюю подписку каждого пользователя
      const uniqueUsers = new Map<string, any>();
      for (const subscription of inactiveSubscriptions) {
        if (subscription.telegramId && !uniqueUsers.has(subscription.telegramId)) {
          uniqueUsers.set(subscription.telegramId, subscription);
        }
      }

      let notified = 0;
      let failed = 0;

      for (const [telegramId, subscription] of uniqueUsers) {
        // Отправляем только если подписка истекла больше 1 дня назад
        const daysSinceExpired = Math.floor(
          (Date.now() - new Date(subscription.endDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceExpired < 1) {
          continue;
        }

        const success = await this.userBotService.notifyInactiveUser(telegramId);

        if (success) {
          notified++;
        } else {
          failed++;
        }

        // Задержка между сообщениями
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.logger.log(
        `Reactivation messages sent: ${notified} successful, ${failed} failed out of ${uniqueUsers.size} inactive users`
      );
    } catch (error) {
      this.logger.error('Error sending reactivation messages:', error);
    }
  }
}
