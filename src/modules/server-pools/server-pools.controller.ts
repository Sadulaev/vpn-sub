import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { ServerPoolsService } from './server-pools.service';
import { CreateServerDto, CreatePoolDto, UpdateServerDto, UpdatePoolDto } from './dto';

@ApiTags('Server Pools')
@Controller('server-pools')
export class ServerPoolsController {
  constructor(private readonly serverPoolsService: ServerPoolsService) {}

  // ─── Пулы серверов ───

  @Get('pools')
  @ApiOperation({ 
    summary: 'Получить все пулы', 
    description: 'Возвращает список всех активных пулов серверов с их серверами' 
  })
  @ApiResponse({ status: 200, description: 'Список пулов успешно получен' })
  async getAllPools() {
    return this.serverPoolsService.findAllPools();
  }

  @Get('pools/:id')
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

  @Post('pools')
  @ApiOperation({ 
    summary: 'Создать пул серверов', 
    description: 'Создаёт новый пул для группировки серверов по регионам или другим критериям' 
  })
  @ApiResponse({ status: 201, description: 'Пул успешно создан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  async createPool(@Body() dto: CreatePoolDto) {
    return this.serverPoolsService.createPool(dto);
  }

  @Put('pools/:id')
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

  @Delete('pools/:id')
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

  // ─── Серверы ───

  @Get('servers')
  @ApiOperation({ 
    summary: 'Получить все серверы', 
    description: 'Возвращает список всех XUI серверов (включая неактивные)' 
  })
  @ApiResponse({ status: 200, description: 'Список серверов успешно получен' })
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

  @Post('servers')
  @ApiOperation({ 
    summary: 'Добавить новый сервер', 
    description: 'Создаёт новый XUI сервер с параметрами подключения к панели 3x-ui и настройками VLESS' 
  })
  @ApiResponse({ status: 201, description: 'Сервер успешно создан' })
  @ApiResponse({ status: 400, description: 'Некорректные данные' })
  @ApiResponse({ status: 404, description: 'Указанный пул не найден' })
  async createServer(@Body() dto: CreateServerDto) {
    return this.serverPoolsService.createServer(dto);
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
}
