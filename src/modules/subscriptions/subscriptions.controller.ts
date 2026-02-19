import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  Logger,
  HttpStatus,
  Inject,
  forwardRef,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto, SendMessageDto } from './dto';
import { UserBotService } from '@modules/bot/services/user-bot.service';
import { SubscriptionSource } from '@database/entities';

// API контроллер для управления подписками (с префиксом /api)
@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionsService: SubscriptionsService,
    @Inject(forwardRef(() => UserBotService))
    private readonly userBotService: UserBotService,
  ) {}

  @Get()
  @ApiOperation({ 
    summary: 'Поиск подписок', 
    description: 'Возвращает список подписок с фильтрацией и поиском' 
  })
  @ApiQuery({ name: 'search', required: false, description: 'Поиск по clientId или примечанию' })
  @ApiQuery({ name: 'source', required: false, enum: SubscriptionSource, description: 'Фильтр по источнику' })
  @ApiResponse({ status: 200, description: 'Список подписок успешно получен' })
  async getAllSubscriptions(
    @Query('search') search?: string,
    @Query('source') source?: SubscriptionSource,
  ) {
    return this.subscriptionsService.search({ search, source });
  }

  @Post()
  @ApiOperation({ summary: 'Создать подписку', description: 'Создаёт подписку, регистрирует клиента на всех 3x-ui серверах и создает подписку на указанный период.' })
  @ApiBody({ type: CreateSubscriptionDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Подписка создана', 
    schema: { 
      example: { 
        success: true, 
        data: { 
          subscriptionId: 'uuid', 
          clientId: 'uuid', 
          subscriptionUrl: 'http://localhost:3000/sub/uuid', 
          serversTotal: 5,
          serversSuccess: 4,
          serversFailed: 1,
          successServers: ['Germany-1', 'France-1'],
          failedServers: ['US-1']
        } 
      } 
    } 
  })
  async createSubscription(@Body() dto: CreateSubscriptionDto) {
    this.logger.log(`Creating subscription for ${dto.days} days`);

    const result = await this.subscriptionsService.createSubscription(dto);

    return {
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        clientId: result.clientId,
        subscriptionUrl: result.subscriptionUrl,
        serversTotal: result.serverResults.success.length + result.serverResults.failed.length,
        serversSuccess: result.serverResults.success.length,
        serversFailed: result.serverResults.failed.length,
        successServers: result.serverResults.success,
        failedServers: result.serverResults.failed,
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

  @Post('send-message')
  @ApiOperation({ 
    summary: 'Отправить сообщение пользователям', 
    description: 'Отправляет сообщение через Telegram бота. Если указан telegramId - отправляет одному пользователю, иначе - всем с активными подписками' 
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Результат отправки сообщений', 
    schema: { 
      example: { 
        success: true, 
        data: { sent: 10, failed: 0, errors: [] } 
      } 
    } 
  })
  async sendMessage(@Body() dto: SendMessageDto) {
    this.logger.log(`Sending message${dto.telegramId ? ` to user ${dto.telegramId}` : ' to all users'}`);
    
    const result = await this.userBotService.sendMessage(dto.message, dto.telegramId);
    
    return {
      success: true,
      data: result,
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
