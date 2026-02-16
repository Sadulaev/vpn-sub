import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@Controller()
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  /**
   * Создать подписку для клиента.
   * На время первой реализации — открытый эндпоинт (позже свяжем с оплатой).
   *
   * POST /api/subscriptions
   * Body: { telegramId, username?, firstName?, months }
   */
  @Post('api/subscriptions')
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    this.logger.log(`Creating subscription for tg:${dto.telegramId}, ${dto.months} months`);

    const result = await this.subscriptionsService.createSubscription(dto);

    return {
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        clientId: result.clientId,
        subscriptionUrl: result.subscriptionUrl,
        servers: result.serverResults,
      },
    };
  }

  /**
   * Получить подписку (VLESS-конфиги) для клиента.
   * Формат: base64(vless-ссылки, по одной на строку).
   * Используется приложениями v2rayTun, Happ, Streisand и т.д.
   *
   * GET /sub/:clientId
   */
  @Get('sub/:clientId')
  async getSubscription(
    @Param('clientId') clientId: string,
    @Res() res: Response,
  ) {
    try {
      const content = await this.subscriptionsService.getSubscriptionContent(clientId);

      if (!content) {
        return res.status(HttpStatus.NOT_FOUND).send('No servers available');
      }

      // Стандартные заголовки для subscription-формата
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Profile-Update-Interval', '6'); // обновлять каждые 6 часов
      res.setHeader('Subscription-Userinfo', ''); // в будущем можно добавить трафик

      return res.send(content);
    } catch (error: any) {
      if (error?.status === 404) {
        return res.status(HttpStatus.NOT_FOUND).send(error.message);
      }
      this.logger.error(`Error getting subscription for ${clientId}:`, error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal error');
    }
  }

  /**
   * Обработать истёкшие подписки — удалить клиентов с серверов.
   * В будущем можно повесить на cron. Пока — ручной вызов.
   *
   * POST /api/subscriptions/process-expired
   */
  @Post('api/subscriptions/process-expired')
  async processExpired() {
    this.logger.log('Processing expired subscriptions...');
    const result = await this.subscriptionsService.processExpiredSubscriptions();

    return {
      success: true,
      data: result,
    };
  }

  /**
   * Получить активные подписки клиента по Telegram ID.
   *
   * GET /api/subscriptions/telegram/:telegramId
   */
  @Get('api/subscriptions/telegram/:telegramId')
  async getByTelegramId(@Param('telegramId') telegramId: string) {
    const subscriptions =
      await this.subscriptionsService.getActiveSubscriptionsByTelegramId(telegramId);

    return {
      success: true,
      data: subscriptions,
    };
  }
}
