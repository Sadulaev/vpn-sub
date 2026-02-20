import {
  Controller,
  Get,
  Param,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { XuiApiService } from '@modules/xui-api';
import { ServerPoolsService } from '@modules/server-pools';

// Публичный контроллер для v2ray клиентов (БЕЗ префикса /api)
@ApiTags('Public Subscription')
@Controller('sub')
export class SubscriptionPublicController {
  private readonly logger = new Logger(SubscriptionPublicController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    private readonly xuiApiService: XuiApiService,
    private readonly serverPoolsService: ServerPoolsService,
  ) {}

  @Get(':clientId')
  @ApiOperation({ 
    summary: 'Получить подписку (VLESS-конфиги)', 
    description: 'Возвращает base64-строку со ВСЕМИ VLESS-ссылками активных серверов. Заголовки содержат метаинформацию (название, трафик, срок). Формат совместим с v2rayTun, Happ, Streisand. Эндпоинт доступен по пути /sub/:clientId (без префикса /api)' 
  })
  @ApiParam({ name: 'clientId', description: 'UUID клиента', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Base64 строка с VLESS-ссылками + заголовки с метаданными', type: String })
  @ApiResponse({ status: 404, description: 'Клиент или активная подписка не найдены' })
  async getSubscription(
    @Param('clientId') clientId: string,
    @Res() res: Response,
  ) {
    try {
      // Проверяем лимит устройств перед выдачей подписки
      const subscription = await this.subscriptionsService.findByClientId(clientId);
      
      if (subscription && subscription.deviceLimit) {
        const activeServers = await this.serverPoolsService.findAllActiveServers();
        const onlineDevices = await this.xuiApiService.getOnlineDevicesCount(clientId, activeServers);
        
        if (onlineDevices >= subscription.deviceLimit) {
          this.logger.warn(
            `Device limit exceeded for client ${clientId.slice(0, 8)}: ${onlineDevices}/${subscription.deviceLimit}`
          );
          
          // Возвращаем специальное сообщение вместо подписки
          const errorMessage = Buffer.from(
            `⚠️ Превышен лимит устройств\n\n` +
            `Одновременно подключено: ${onlineDevices}\n` +
            `Максимально разрешено: ${subscription.deviceLimit}\n\n` +
            `Отключите другие устройства и попробуйте снова через несколько минут.`
          ).toString('base64');
          
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          return res.send(errorMessage);
        }
        
        this.logger.debug(
          `Device limit check passed for client ${clientId.slice(0, 8)}: ${onlineDevices}/${subscription.deviceLimit}`
        );
      }

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
      res.setHeader('profile-update-interval', '1');
      
      // Информация о подписке: трафик и дата окончания
      // Формат: upload=usedBytes; download=usedBytes; total=limitBytes (0=unlimited); expire=timestamp
      // В v2ray клиентах usedTraffic отображается как использованный объём
      const userinfo = `upload=${result.usedTraffic}; download=${result.usedTraffic}; total=${result.totalTraffic}; expire=${result.expireTimestamp}`;
      res.setHeader('subscription-userinfo', userinfo);
      
      // Ссылка на бот (опционально)
      res.setHeader('profile-web-page-url', 'https://t.me/bekvpn_bot');

      return res.send(result.content);
    } catch (error: any) {
      if (error?.status === 404) {
        return res.status(HttpStatus.NOT_FOUND).send(error.message);
      }
      this.logger.error(`Error getting subscription for ${clientId}:`, error);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Internal error');
    }
  }
}
