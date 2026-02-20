import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ServerPoolsService } from './server-pools.service';
import { CreateServerDto, CreatePoolDto, UpdateServerDto, UpdatePoolDto } from './dto';

@ApiTags('Server Pools')
@Controller('server-pools')
export class ServerPoolsController {
  constructor(private readonly serverPoolsService: ServerPoolsService) {}

  // ─── Пулы серверов ───

  @Get()
  @ApiOperation({ 
    summary: 'Получить все пулы', 
    description: 'Возвращает список всех активных пулов серверов с их серверами' 
  })
  @ApiResponse({ status: 200, description: 'Список пулов успешно получен' })
  async getAllPools() {
    return this.serverPoolsService.findAllPools();
  }

  @Post()
  @ApiOperation({ 
    summary: 'Создать пул серверов', 
    description: 'Создаёт новый пул для группировки серверов по регионам или другим критериям' 
  })
  @ApiResponse({ status: 201, description: 'Пул успешно создан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async createPool(@Body() dto: CreatePoolDto) {
    return this.serverPoolsService.createPool(dto);
  }

  // ─── Серверы ───

  @Get('servers')
  @ApiOperation({ 
    summary: 'Получить все серверы', 
    description: 'Возвращает список всех XUI серверов (включая неактивные)' 
  })
  @ApiResponse({ status: 200, description: 'Список серверов успешно получен' })
  async getAllServers() {
    return this.serverPoolsService.findAllServers();
  }

  @Get('servers/active')
  @ApiOperation({ 
    summary: 'Получить активные серверы', 
    description: 'Возвращает список только активных XUI серверов' 
  })
  @ApiResponse({ status: 200, description: 'Список активных серверов успешно получен' })
  async getActiveServers() {
    return this.serverPoolsService.findAllActiveServers();
  }

  @Get('servers/:id')
  @ApiOperation({ 
    summary: 'Получить сервер по ID', 
    description: 'Возвращает информацию о конкретном сервере' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ status: 200, description: 'Сервер найден' })
  @ApiResponse({ status: 404, description: 'Сервер не найден' })
  async getServerById(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.findServerById(id);
  }

  @Post('servers')
  @ApiOperation({ 
    summary: 'Добавить новый сервер (асинхронно)', 
    description: 'Создаёт новый XUI сервер и запускает фоновую синхронизацию клиентов. Сразу возвращает сервер и статус синхронизации.' 
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Сервер успешно создан, синхронизация запущена в фоне',
    schema: {
      example: {
        server: { id: 1, name: 'Germany-1', status: 'active' },
        syncStatus: { 
          status: 'started', 
          estimatedTimeMs: 8000, 
          message: 'Synchronization started for 40 clients in background' 
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 404, description: 'Указанный пул не найден' })
  async createServer(@Body() dto: CreateServerDto) {
    return this.serverPoolsService.createServer(dto);
  }

  @Put('servers/:id')
  @ApiOperation({ 
    summary: 'Обновить сервер', 
    description: 'Обновляет параметры XUI сервера' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ status: 200, description: 'Сервер успешно обновлён' })
  @ApiResponse({ status: 404, description: 'Сервер не найден' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async updateServer(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateServerDto) {
    return this.serverPoolsService.updateServer(id, dto);
  }

  @Delete('servers/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Удалить сервер', 
    description: 'Удаляет XUI сервер из системы' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ status: 204, description: 'Сервер успешно удалён' })
  @ApiResponse({ status: 404, description: 'Сервер не найден' })
  async deleteServer(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.deleteServer(id);
  }

  @Post('servers/:id/sync')
  @ApiOperation({ 
    summary: 'Синхронизировать клиентов (асинхронно)', 
    description: 'Запускает фоновую синхронизацию всех активных подписок на сервер. Сразу возвращает статус и примерное время выполнения.' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ 
    status: 200, 
    description: 'Синхронизация запущена',
    schema: {
      example: {
        status: 'started',
        serverId: 1,
        serverName: 'Germany-1',
        estimatedTimeMs: 40000,
        message: 'Synchronization started for 200 clients. Estimated time: 40 seconds'
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Сервер не найден' })
  @ApiResponse({ status: 400, description: 'Синхронизация уже запущена' })
  async syncServerClients(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.syncServerClients(id);
  }

  @Get('servers/:id/sync-status')
  @ApiOperation({ 
    summary: 'Получить статус синхронизации', 
    description: 'Возвращает текущий статус синхронизации сервера (in-progress, completed, failed)' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ 
    status: 200, 
    description: 'Статус синхронизации',
    schema: {
      example: {
        serverId: 1,
        serverName: 'Germany-1',
        status: 'in-progress',
        total: 200,
        processed: 50,
        success: 48,
        failed: 2,
        startedAt: '2026-02-20T10:00:00.000Z',
        estimatedTimeMs: 40000
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Статус синхронизации не найден' })
  async getSyncStatus(@Param('id', ParseIntPipe) id: number) {
    const status = this.serverPoolsService.getSyncStatus(id);
    if (!status) {
      return { message: 'No synchronization found for this server' };
    }
    return status;
  }

  @Get('sync-status/all')
  @ApiOperation({ 
    summary: 'Получить все статусы синхронизации', 
    description: 'Возвращает статусы всех активных синхронизаций' 
  })
  @ApiResponse({ status: 200, description: 'Список всех статусов синхронизации' })
  async getAllSyncStatuses() {
    return this.serverPoolsService.getAllSyncStatuses();
  }

  @Delete('servers/:id/sync-status')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Очистить статус синхронизации', 
    description: 'Удаляет статус завершённой или неудачной синхронизации из памяти' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ status: 204, description: 'Статус успешно очищен' })
  @ApiResponse({ status: 400, description: 'Невозможно удалить активную синхронизацию' })
  async clearSyncStatus(@Param('id', ParseIntPipe) id: number) {
    const cleared = this.serverPoolsService.clearSyncStatus(id);
    if (!cleared) {
      throw new Error('Cannot clear sync status: synchronization is in progress or not found');
    }
  }

  @Post('servers/:id/migrate-emails')
  @ApiOperation({ 
    summary: 'Мигрировать email клиентов', 
    description: 'Обновляет email всех клиентов на сервере с формата client-{uuid} на полный UUID для устранения коллизий' 
  })
  @ApiParam({ name: 'id', description: 'ID сервера' })
  @ApiResponse({ 
    status: 200, 
    description: 'Миграция завершена',
    schema: {
      example: {
        total: 150,
        updated: 148,
        failed: 2,
        errors: ['Client abc12345: failed to update']
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Сервер не найден' })
  async migrateServerEmails(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.migrateServerEmails(id);
  }

  // ─── Статистика ───

  @Get('stats/load')
  @ApiOperation({ 
    summary: 'Получить статистику нагрузки', 
    description: 'Возвращает статистику по количеству активных клиентов на каждом сервере, сгруппированную по пулам' 
  })
  @ApiResponse({ status: 200, description: 'Статистика успешно получена' })
  async getLoadStatistics() {
    return this.serverPoolsService.getLoadStatistics();
  }

  @Get('stats/best-servers')
  @ApiOperation({ 
    summary: 'Получить оптимальные серверы', 
    description: 'Для каждого пула возвращает сервер с наименьшей нагрузкой (используется при создании подписок)' 
  })
  @ApiResponse({ status: 200, description: 'Список оптимальных серверов получен' })
  async getBestServers() {
    return this.serverPoolsService.getBestServersPerPool();
  }

  // ─── Пулы по ID (ДОЛЖНЫ БЫТЬ В КОНЦЕ!) ───

  @Get(':id')
  @ApiOperation({ 
    summary: 'Получить пул по ID', 
    description: 'Возвращает информацию о пуле с его серверами' 
  })
  @ApiParam({ name: 'id', description: 'ID пула' })
  @ApiResponse({ status: 200, description: 'Пул найден' })
  @ApiResponse({ status: 404, description: 'Пул не найден' })
  async getPoolById(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.findPoolById(id);
  }

  @Put(':id')
  @ApiOperation({ 
    summary: 'Обновить пул серверов', 
    description: 'Обновляет данные пула серверов' 
  })
  @ApiParam({ name: 'id', description: 'ID пула' })
  @ApiResponse({ status: 200, description: 'Пул успешно обновлён' })
  @ApiResponse({ status: 404, description: 'Пул не найден' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async updatePool(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePoolDto) {
    return this.serverPoolsService.updatePool(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ 
    summary: 'Удалить пул серверов', 
    description: 'Удаляет пул серверов. Все серверы в этом пуле будут отвязаны от пула (serverPoolId = null)' 
  })
  @ApiParam({ name: 'id', description: 'ID пула' })
  @ApiResponse({ status: 204, description: 'Пул успешно удалён' })
  @ApiResponse({ status: 404, description: 'Пул не найден' })
  async deletePool(@Param('id', ParseIntPipe) id: number) {
    return this.serverPoolsService.deletePool(id);
  }
}
