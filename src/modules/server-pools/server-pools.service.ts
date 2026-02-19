import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerPool, XuiServer, XuiServerStatus } from '@database/entities';
import { XuiApiService } from '@modules/xui-api';
import { CreateServerDto, CreatePoolDto, UpdateServerDto, UpdatePoolDto } from './dto';

export interface ServerWithLoad {
  server: XuiServer;
  activeClients: number;
}

export interface PoolWithBestServer {
  pool: ServerPool;
  bestServer: XuiServer | null;
  activeClients: number;
}

@Injectable()
export class ServerPoolsService {
  private readonly logger = new Logger(ServerPoolsService.name);

  constructor(
    @InjectRepository(ServerPool)
    private readonly poolRepo: Repository<ServerPool>,
    @InjectRepository(XuiServer)
    private readonly xuiServerRepo: Repository<XuiServer>,
    private readonly xuiApi: XuiApiService,
  ) {}

  // ─── Пулы ───

  async findAllPools(): Promise<ServerPool[]> {
    return this.poolRepo.find({
      where: { isActive: true },
      relations: ['servers'],
    });
  }

  async findPoolById(id: number): Promise<ServerPool | null> {
    return this.poolRepo.findOne({
      where: { id },
      relations: ['servers'],
    });
  }

  async createPool(dto: CreatePoolDto): Promise<ServerPool> {
    const pool = this.poolRepo.create({
      name: dto.name,
      description: dto.description || null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.poolRepo.save(pool);
    this.logger.log(`Created pool: ${saved.id} (${saved.name})`);
    return saved;
  }

  async updatePool(id: number, dto: UpdatePoolDto): Promise<ServerPool> {
    const pool = await this.poolRepo.findOne({ where: { id } });
    if (!pool) {
      throw new NotFoundException(`Server pool with ID ${id} not found`);
    }

    if (dto.name !== undefined) pool.name = dto.name;
    if (dto.description !== undefined) pool.description = dto.description;
    if (dto.isActive !== undefined) pool.isActive = dto.isActive;

    const updated = await this.poolRepo.save(pool);
    this.logger.log(`Updated pool: ${updated.id} (${updated.name})`);
    return updated;
  }

  async deletePool(id: number): Promise<void> {
    const pool = await this.poolRepo.findOne({ where: { id }, relations: ['servers'] });
    if (!pool) {
      throw new NotFoundException(`Server pool with ID ${id} not found`);
    }

    // Отвязываем серверы от пула
    if (pool.servers && pool.servers.length > 0) {
      await this.xuiServerRepo.update(
        { serverPoolId: id },
        { serverPoolId: null }
      );
    }

    await this.poolRepo.remove(pool);
    this.logger.log(`Deleted pool: ${id}`);
  }

  // ─── XUI серверы ───

  /**
   * Получить все активные XUI серверы
   */
  async findAllActiveServers(): Promise<XuiServer[]> {
    return this.xuiServerRepo.find({
      where: { status: XuiServerStatus.ACTIVE },
    });
  }

  /**
   * Получить все серверы (включая упавшие)
   */
  async findAllServers(): Promise<XuiServer[]> {
    return this.xuiServerRepo.find({ relations: ['serverPool'] });
  }

  /**
   * Получить активные серверы конкретного пула
   */
  async findActiveServersByPoolId(poolId: number): Promise<XuiServer[]> {
    return this.xuiServerRepo.find({
      where: { 
        serverPoolId: poolId,
        status: XuiServerStatus.ACTIVE 
      },
    });
  }

  /**
   * Получить сервер по ID
   */
  async findServerById(id: number): Promise<XuiServer | null> {
    return this.xuiServerRepo.findOne({
      where: { id },
      relations: ['serverPool'],
    });
  }

  async createServer(dto: CreateServerDto): Promise<{
    server: XuiServer;
    syncResult: { total: number; success: number; failed: number };
  }> {
    // Проверяем существование пула, если указан
    if (dto.serverPoolId) {
      const pool = await this.poolRepo.findOne({ where: { id: dto.serverPoolId } });
      if (!pool) {
        throw new NotFoundException(`Server pool with ID ${dto.serverPoolId} not found`);
      }
    }

    const server = this.xuiServerRepo.create({
      name: dto.name,
      apiUrl: dto.apiUrl,
      webBasePath: dto.webBasePath || '',
      username: dto.username,
      password: dto.password,
      inboundId: dto.inboundId || null,
      publicHost: dto.publicHost,
      publicPort: dto.publicPort || 443,
      security: dto.security || 'reality',
      pbk: dto.pbk || '',
      fp: dto.fp || 'chrome',
      sni: dto.sni || '',
      sid: dto.sid || '',
      spx: dto.spx || '/',
      flow: dto.flow || '',
      status: dto.status || XuiServerStatus.ACTIVE,
      usersLimit: dto.usersLimit || 100,
      serverPoolId: dto.serverPoolId || null,
    });

    const saved = await this.xuiServerRepo.save(server);
    this.logger.log(`Created server: ${saved.id} (${saved.name})`);

    // Синхронизируем всех активных клиентов на новый сервер
    let syncResult = { total: 0, success: 0, failed: 0 };
    
    if (saved.status === XuiServerStatus.ACTIVE) {
      try {
        const result = await this.xuiApi.syncAllActiveClientsToServer(saved);
        syncResult = {
          total: result.total,
          success: result.success,
          failed: result.failed,
        };
        this.logger.log(
          `Server ${saved.name} sync completed: ${result.success}/${result.total} clients added successfully`,
        );
        if (result.failed > 0) {
          this.logger.warn(
            `Server ${saved.name} sync had ${result.failed} failures. First 5 errors: ${result.errors.slice(0, 5).join('; ')}`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to sync clients to new server ${saved.name}:`, error);
      }
    }

    return { server: saved, syncResult };
  }

  /**
   * Синхронизировать клиентов на сервере
   */
  async syncServerClients(serverId: number): Promise<{
    total: number;
    success: number;
    failed: number;
    errors: string[];
  }> {
    const server = await this.findServerById(serverId);
    
    if (!server) {
      throw new NotFoundException(`Server with ID ${serverId} not found`);
    }
    
    if (server.status !== XuiServerStatus.ACTIVE) {
      throw new Error(`Server ${server.name} is not active`);
    }

    const result = await this.xuiApi.syncAllActiveClientsToServer(server);
    
    this.logger.log(
      `Server ${server.name} manual sync completed: ${result.success}/${result.total} clients synced`,
    );

    return result;
  }

  async updateServer(id: number, dto: UpdateServerDto): Promise<XuiServer> {
    const server = await this.xuiServerRepo.findOne({ where: { id } });
    if (!server) {
      throw new NotFoundException(`Server with ID ${id} not found`);
    }

    // Проверяем существование пула, если он изменяется
    if (dto.serverPoolId !== undefined && dto.serverPoolId !== null) {
      const pool = await this.poolRepo.findOne({ where: { id: dto.serverPoolId } });
      if (!pool) {
        throw new NotFoundException(`Server pool with ID ${dto.serverPoolId} not found`);
      }
    }

    // Обновляем только переданные поля
    if (dto.name !== undefined) server.name = dto.name;
    if (dto.apiUrl !== undefined) server.apiUrl = dto.apiUrl;
    if (dto.webBasePath !== undefined) server.webBasePath = dto.webBasePath;
    if (dto.username !== undefined) server.username = dto.username;
    if (dto.password !== undefined) server.password = dto.password;
    if (dto.inboundId !== undefined) server.inboundId = dto.inboundId;
    if (dto.publicHost !== undefined) server.publicHost = dto.publicHost;
    if (dto.publicPort !== undefined) server.publicPort = dto.publicPort;
    if (dto.security !== undefined) server.security = dto.security;
    if (dto.pbk !== undefined) server.pbk = dto.pbk;
    if (dto.fp !== undefined) server.fp = dto.fp;
    if (dto.sni !== undefined) server.sni = dto.sni;
    if (dto.sid !== undefined) server.sid = dto.sid;
    if (dto.spx !== undefined) server.spx = dto.spx;
    if (dto.flow !== undefined) server.flow = dto.flow;
    if (dto.status !== undefined) server.status = dto.status;
    if (dto.usersLimit !== undefined) server.usersLimit = dto.usersLimit;
    if (dto.serverPoolId !== undefined) server.serverPoolId = dto.serverPoolId;

    const updated = await this.xuiServerRepo.save(server);
    this.logger.log(`Updated server: ${updated.id} (${updated.name})`);
    return updated;
  }

  async deleteServer(id: number): Promise<void> {
    const server = await this.xuiServerRepo.findOne({ where: { id } });
    if (!server) {
      throw new NotFoundException(`Server with ID ${id} not found`);
    }

    await this.xuiServerRepo.remove(server);
    this.logger.log(`Deleted server: ${id} (${server.name})`);
  }

  /**
   * Для каждого активного пула выбрать наименее нагруженный сервер
   */
  async getBestServersPerPool(): Promise<PoolWithBestServer[]> {
    const pools = await this.findAllPools();
    const results: PoolWithBestServer[] = [];

    for (const pool of pools) {
      const activeServers = (pool.servers || []).filter(
        (s) => s.status === XuiServerStatus.ACTIVE,
      );

      if (activeServers.length === 0) {
        results.push({ pool, bestServer: null, activeClients: 0 });
        continue;
      }

      // Получаем нагрузку всех серверов в пуле параллельно
      const serversWithLoad: ServerWithLoad[] = [];

      await Promise.all(
        activeServers.map(async (server) => {
          const count = await this.xuiApi.getActiveClientsCount(server);
          if (count !== null) {
            serversWithLoad.push({ server, activeClients: count });
          }
        }),
      );

      if (serversWithLoad.length === 0) {
        results.push({ pool, bestServer: null, activeClients: 0 });
        continue;
      }

      // Выбираем наименее нагруженный
      const best = serversWithLoad.reduce((a, b) =>
        a.activeClients <= b.activeClients ? a : b,
      );

      results.push({
        pool,
        bestServer: best.server,
        activeClients: best.activeClients,
      });
    }

    return results;
  }

  /**
   * Получить статистику нагрузки всех серверов (сгруппировано по пулам)
   */
  async getLoadStatistics(): Promise<
    { pool: string; servers: { name: string; status: string; clients: number | null }[] }[]
  > {
    const pools = await this.findAllPools();
    const stats: { pool: string; servers: { name: string; status: string; clients: number | null }[] }[] = [];

    for (const pool of pools) {
      const serverStats: { name: string; status: string; clients: number | null }[] = [];

      for (const server of pool.servers || []) {
        if (server.status !== XuiServerStatus.ACTIVE) {
          serverStats.push({ name: server.name, status: server.status, clients: null });
          continue;
        }

        const count = await this.xuiApi.getActiveClientsCount(server);
        serverStats.push({
          name: server.name,
          status: server.status,
          clients: count,
        });
      }

      stats.push({ pool: pool.name, servers: serverStats });
    }

    return stats;
  }
}
