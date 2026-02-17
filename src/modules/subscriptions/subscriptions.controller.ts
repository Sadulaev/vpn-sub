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
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

@ApiTags('Subscriptions')
@Controller()
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post('api/subscriptions')
  @ApiOperation({ summary: 'Создать подписку', description: 'Создаёт клиента (если не существует), регистрирует его на всех 3x-ui серверах и создаёт подписку на указанный период. Открытый эндпоинт (позже будет связан с оплатой).' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({ status: 201, description: 'Подписка создана', schema: { example: { success: true, data: { subscriptionId: 'uuid', clientId: 'uuid', subscriptionUrl: '/sub/uuid', servers: { success: ['Germany-1'], failed: [] } } } } })
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

  @Get('sub/:clientId')
  @ApiOperation({ 
    summary: 'Получить подписку (VLESS-конфиги)', 
    description: 'Возвращает base64-строку со ВСЕМИ VLESS-ссылками активных серверов. Заголовки содержат метаинформацию (название, трафик, срок). Формат совместим с v2rayTun, Happ, Streisand.' 
  })
  @ApiParam({ name: 'clientId', description: 'UUID клиента', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Base64 строка с VLESS-ссылками + заголовки с метаданными', type: String })
  @ApiResponse({ status: 404, description: 'Клиент или активная подписка не найдены' })
  async getSubscription(
    @Param('clientId') clientId: string,
    @Res() res: Response,
  ) {
    try {
      const result = await this.subscriptionsService.getSubscriptionContent(clientId);

      if (!result) {
        return res.status(HttpStatus.NOT_FOUND).send('No servers available');
      }

      // Стандартные заголовки для subscription-формата (v2rayTun, Happ, Streisand и др.)
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline');
      
      // Название подписки (отображается вверху в клиенте)
      res.setHeader('profile-title', 'base64:' + Buffer.from('Hyper-VPN').toString('base64'));
      
      // Интервал обновления (в часах)
      res.setHeader('profile-update-interval', '6');
      
      // Информация о подписке: трафик и дата окончания
      // Формат: upload=usedBytes; download=usedBytes; total=limitBytes (0=unlimited); expire=timestamp
      // В v2ray клиентах usedTraffic отображается как использованный объём
      const userinfo = `upload=${result.usedTraffic}; download=${result.usedTraffic}; total=${result.totalTraffic}; expire=${result.expireTimestamp}`;
      res.setHeader('subscription-userinfo', userinfo);
      
      // Ссылка на бот (опционально)
      res.setHeader('profile-web-page-url', 'https://t.me/hyper_vpn_bot');

      return res.send(result.content);
    } catch (error: any) {
      if (error?.status === 404) {
        return res.status(HttpStatus.NOT_FOUND).send(error.message);
      }
      this.logger.error(`Error getting subscription for ${clientId}:`, error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal error');
    }
  }

  @Post('api/subscriptions/process-expired')
  @ApiOperation({ summary: 'Обработать истёкшие подписки', description: 'Находит все подписки с истёкшим сроком, удаляет клиентов со всех серверов (если нет других активных подписок) и помечает подписки как expired. В будущем — на cron.' })
  @ApiResponse({ status: 200, description: 'Результат обработки', schema: { example: { success: true, data: { expired: 2, clientsRemoved: ['uuid1', 'uuid2'] } } } })
  async processExpired() {
    this.logger.log('Processing expired subscriptions...');
    const result = await this.subscriptionsService.processExpiredSubscriptions();

    return {
      success: true,
      data: result,
    };
  }

  @Get('api/subscriptions/telegram/:telegramId')
  @ApiOperation({ summary: 'Подписки по Telegram ID', description: 'Возвращает список активных подписок клиента по его Telegram ID.' })
  @ApiParam({ name: 'telegramId', description: 'Telegram ID пользователя', example: '123456789' })
  @ApiResponse({ status: 200, description: 'Список активных подписок', schema: { example: { success: true, data: [{ id: 'uuid', clientId: 'uuid', status: 'active', months: 3, startDate: '2026-02-16', endDate: '2026-05-17' }] } } })
  async getByTelegramId(@Param('telegramId') telegramId: string) {
    const subscriptions =
      await this.subscriptionsService.getActiveSubscriptionsByTelegramId(telegramId);

    return {
      success: true,
      data: subscriptions,
    };
  }
}
