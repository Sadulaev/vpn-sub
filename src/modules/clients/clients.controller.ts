import { Controller, Get, Post, Put, Delete, Body, Param, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @ApiOperation({ 
    summary: 'Создать клиента', 
    description: 'Создаёт нового клиента в системе. Если клиент с таким Telegram ID уже существует, вернётся ошибка. Используйте POST /subscriptions для автоматического создания клиента и подписки.' 
  })
  @ApiResponse({ status: 201, description: 'Клиент успешно создан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 409, description: 'Клиент с таким Telegram ID уже существует' })
  async createClient(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ 
    summary: 'Получить клиента по UUID', 
    description: 'Возвращает информацию о клиенте по его UUID' 
  })
  @ApiParam({ name: 'id', description: 'UUID клиента' })
  @ApiResponse({ status: 200, description: 'Клиент найден' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  async getClientById(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findById(id);
  }

  @Get('telegram/:telegramId')
  @ApiOperation({ 
    summary: 'Получить клиента по Telegram ID', 
    description: 'Возвращает информацию о клиенте по его Telegram ID' 
  })
  @ApiParam({ name: 'telegramId', description: 'Telegram ID клиента' })
  @ApiResponse({ status: 200, description: 'Клиент найден' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  async getClientByTelegramId(@Param('telegramId') telegramId: string) {
    return this.clientsService.findByTelegramId(telegramId);
  }

  @Get(':id/subscriptions')
  @ApiOperation({ 
    summary: 'Получить клиента с подписками', 
    description: 'Возвращает информацию о клиенте вместе со всеми его подписками' 
  })
  @ApiParam({ name: 'id', description: 'UUID клиента' })
  @ApiResponse({ status: 200, description: 'Клиент с подписками найден' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  async getClientWithSubscriptions(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.findByIdWithSubscriptions(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Обновить клиента', 
    description: 'Обновляет данные клиента (username, firstName, isActive). Telegram ID изменить нельзя.' 
  })
  @ApiParam({ name: 'id', description: 'UUID клиента' })
  @ApiResponse({ status: 200, description: 'Клиент успешно обновлён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async updateClient(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Удалить клиента', 
    description: 'Удаляет клиента из системы. ВНИМАНИЕ: При удалении клиента его подписки также будут удалены (каскадное удаление).' 
  })
  @ApiParam({ name: 'id', description: 'UUID клиента' })
  @ApiResponse({ status: 204, description: 'Клиент успешно удалён' })
  @ApiResponse({ status: 404, description: 'Клиент не найден' })
  async deleteClient(@Param('id', ParseUUIDPipe) id: string) {
    return this.clientsService.delete(id);
  }
}
