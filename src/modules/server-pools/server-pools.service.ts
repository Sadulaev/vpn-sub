import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServerPool, XuiServer, XuiServerStatus } from '@database/entities';
import { XuiApiService } from '@modules/xui-api';

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
