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

// API контроллер для управления подписками (с префиксом /api)
@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  @ApiOperation({ 
    summary: 'Получить все подписки', 
    description: 'Возвращает список всех подписок в системе' 
  })
  @ApiResponse({ status: 200, description: 'Список подписок успешно получен' })
  async getAllSubscriptions() {
    return this.subscriptionsService.findAll();
  }

  @Post()
  @ApiOperation({ summary: 'Создать подписку', description: 'Создаёт подписку, регистрирует клиента на всех 3x-ui серверах и создает подписку на указанный период.' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({ status: 201, description: 'Подписка создана', schema: { example: { success: true, data: { subscriptionId: 'uuid', clientId: 'uuid', subscriptionUrl: 'http://localhost:3000/sub/uuid', servers: { success: ['Germany-1'], failed: [] } } } } })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    this.logger.log(`Creating subscription for ${dto.months} months`);

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

  @Post('process-expired')
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

  @Get(':id/url')
  @ApiOperation({ 
    summary: 'Получить URL подписки', 
    description: 'Возвращает полный URL подписки для клиента по ID подписки' 
  })
  @ApiParam({ name: 'id', description: 'ID подписки', example: 'uuid' })
  @ApiResponse({ status: 200, description: 'URL подписки', schema: { example: { success: true, data: { subscriptionUrl: 'http://localhost:3000/sub/client-uuid' } } } })
  async getSubscriptionUrl(@Param('id') id: string) {
    const url = await this.subscriptionsService.getSubscriptionUrl(id);
    
    return {
      success: true,
      data: { subscriptionUrl: url },
    };
  }

  @Post(':id/delete')
  @ApiOperation({ 
    summary: 'Удалить подписку', 
    description: 'Удаляет подписку и клиента со всех серверов (если нет других активных подписок)' 
  })
  @ApiParam({ name: 'id', description: 'ID подписки', example: 'uuid' })
  @ApiResponse({ status: 200, description: 'Подписка удалена' })
  async deleteSubscription(@Param('id') id: string) {
    this.logger.log(`Deleting subscription ${id}`);
    const result = await this.subscriptionsService.deleteSubscription(id);
    
    return {
      success: true,
      data: result,
    };
  }
}
