import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VpnServerConfig } from '@common/config';
import {
  ServerWithLoad,
  VlessKeyResult,
  InboundsResponse,
  InboundClient,
} from './interfaces/vpn-server.interface';
import * as crypto from 'crypto';

@Injectable()
export class VpnServersService {
  private readonly logger = new Logger(VpnServersService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Получить список активных серверов из конфигурации
   */
  getServers(): VpnServerConfig[] {
    return this.configService.get<VpnServerConfig[]>('vpnServers.servers') || [];
  }

  /**
   * Авторизация в панели 3x-ui и получение cookie
   */
  private async getLoginCookies(server: VpnServerConfig): Promise<string | null> {
    try {
      const loginUrl = new URL(
        `/${server.webBasePath}/login`,
        server.apiUrl,
      ).toString();

      const form = new URLSearchParams({
        username: server.username,
        password: server.password,
      });

      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
        redirect: 'manual',
      });

      const setCookie = response.headers.get('set-cookie');
      if (!setCookie || (!response.ok && response.status !== 302)) {
        throw new Error(`Login failed with status: ${response.status}`);
      }

      return setCookie;
    } catch (error) {
      this.logger.error(`Failed to login to server ${server.id}:`, error);
      return null;
    }
  }

  /**
   * Получить список inbounds сервера
   */
  private async getInbounds(
    server: VpnServerConfig,
    cookie: string,
  ): Promise<InboundsResponse | null> {
    try {
      const url = new URL(
        `/${server.webBasePath}/panel/api/inbounds/list`,
        server.apiUrl,
      ).toString();

      const response = await fetch(url, {
        method: 'GET',
        headers: { Cookie: cookie },
      });

      if (!response.ok) {
        throw new Error(`Get inbounds failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get inbounds from ${server.id}:`, error);
      return null;
    }
  }

  /**
   * Добавить клиента в inbound
   */
  private async addClient(
    server: VpnServerConfig,
    inboundId: number,
    client: InboundClient,
    cookie: string,
  ): Promise<boolean> {
    try {
      const url = new URL(
        `/${server.webBasePath}/panel/api/inbounds/addClient`,
        server.apiUrl,
      ).toString();

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify({
          id: inboundId,
          settings: JSON.stringify({ clients: [client] }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Add client failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to add client to ${server.id}:`, error);
      return false;
    }
  }

  /**
   * Построить VLESS ссылку из конфигурации сервера
   */
  private buildVlessLink(
    server: VpnServerConfig,
    clientId: string,
  ): string {
    const params = new URLSearchParams();
    params.set('type', 'tcp');
    params.set('encryption', 'none');
    params.set('security', server.security);
    params.set('pbk', server.pbk);
    params.set('fp', server.fp);
    params.set('sni', server.sni);
    params.set('sid', server.sid);
    params.set('spx', server.spx);

    return `vless://${clientId}@${server.publicHost}:${server.publicPort}?${params.toString()}#HyperVPN-${server.id}`;
  }

  /**
   * Вычислить время истечения ключа (месяцы + 1 день запаса)
   */
  private calculateExpiryTime(months: number): number {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    date.setDate(date.getDate() + 1);
    return date.getTime();
  }

  /**
   * Выбрать лучший сервер на основе нагрузки
   */
  private chooseBestServer(servers: ServerWithLoad[]): ServerWithLoad | null {
    if (servers.length === 0) return null;

    // Сначала ищем сервер, который не превысил лимит
    const available = servers.find((s) => s.currentUsers < s.usersLimit);
    if (available) return available;

    // Если все превысили лимит — выбираем с наименьшим числом пользователей
    return servers.reduce((best, current) =>
      current.currentUsers < best.currentUsers ? current : best,
    );
  }

  /**
   * Получить информацию о нагрузке всех серверов
   */
  async getServersWithLoads(): Promise<ServerWithLoad[]> {
    const servers = this.getServers();
    const result: ServerWithLoad[] = [];

    await Promise.all(
      servers.map(async (server) => {
        const cookie = await this.getLoginCookies(server);
        if (!cookie) return;

        const inbounds = await this.getInbounds(server, cookie);
        if (!inbounds?.obj) return;

        const currentUsers = inbounds.obj.reduce(
          (acc, inbound) => acc + (inbound.clientStats?.length || 0),
          0,
        );

        result.push({
          id: server.id,
          currentUsers,
          usersLimit: server.usersLimit,
          firstInboundId: inbounds.obj[0]?.id || null,
        });
      }),
    );

    return result;
  }

  /**
   * Создать VLESS ключ на оптимальном сервере
   */
  async createVlessKey(months: number): Promise<VlessKeyResult | null> {
    try {
      const serversWithLoads = await this.getServersWithLoads();
      const bestServer = this.chooseBestServer(serversWithLoads);

      if (!bestServer || !bestServer.firstInboundId) {
        this.logger.error('No available servers for key creation');
        return null;
      }

      const servers = this.getServers();
      const serverConfig = servers.find((s) => s.id === bestServer.id);

      if (!serverConfig) {
        this.logger.error(`Server config not found for ${bestServer.id}`);
        return null;
      }

      const cookie = await this.getLoginCookies(serverConfig);
      if (!cookie) {
        this.logger.error(`Failed to authenticate to ${serverConfig.id}`);
        return null;
      }

      const clientId = crypto.randomUUID();
      const client: InboundClient = {
        id: clientId,
        email: crypto.randomUUID(),
        flow: '',
        totalGB: 0,
        expiryTime: this.calculateExpiryTime(months),
        enable: true,
      };

      const added = await this.addClient(
        serverConfig,
        bestServer.firstInboundId,
        client,
        cookie,
      );

      if (!added) {
        this.logger.error('Failed to add client to server');
        return null;
      }

      const vless = this.buildVlessLink(serverConfig, clientId);

      return {
        vless,
        serverId: serverConfig.id,
      };
    } catch (error) {
      this.logger.error('Failed to create VLESS key:', error);
      return null;
    }
  }

  /**
   * Удалить просроченных клиентов из inbound
   */
  private async deleteDepletedClients(
    server: VpnServerConfig,
    inboundId: number,
    cookie: string,
  ): Promise<boolean> {
    try {
      const url = new URL(
        `/${server.webBasePath}/panel/api/inbounds/delDepletedClients/${inboundId}`,
        server.apiUrl,
      ).toString();

      const response = await fetch(url, {
        method: 'POST',
        headers: { Cookie: cookie },
      });

      if (!response.ok) {
        throw new Error(`Delete depleted clients failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete depleted clients from ${server.id}:`, error);
      return false;
    }
  }

  /**
   * Удалить все просроченные подписки со всех серверов
   */
  async deleteAllExpiredClients(): Promise<{ success: string[]; failed: string[] }> {
    const servers = this.getServers();
    const success: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      servers.map(async (server) => {
        const cookie = await this.getLoginCookies(server);
        if (!cookie) {
          failed.push(`${server.id}: ошибка авторизации`);
          return;
        }

        const inbounds = await this.getInbounds(server, cookie);
        if (!inbounds?.obj) {
          failed.push(`${server.id}: не удалось получить inbounds`);
          return;
        }

        for (const inbound of inbounds.obj) {
          const deleted = await this.deleteDepletedClients(server, inbound.id, cookie);
          if (deleted) {
            success.push(`${server.id}/${inbound.remark}`);
          } else {
            failed.push(`${server.id}/${inbound.remark}`);
          }
        }
      }),
    );

    this.logger.log(`Deleted expired clients: ${success.length} success, ${failed.length} failed`);
    return { success, failed };
  }

  /**
   * Получить статистику нагрузки серверов (для админки)
   */
  async getLoadsStatistics(): Promise<Record<string, Record<string, number>>> {
    const servers = this.getServers();
    const loads: Record<string, Record<string, number>> = {};

    await Promise.all(
      servers.map(async (server) => {
        const cookie = await this.getLoginCookies(server);
        if (!cookie) return;

        const inbounds = await this.getInbounds(server, cookie);
        if (!inbounds?.obj) return;

        loads[server.id] = {};
        for (const inbound of inbounds.obj) {
          loads[server.id][inbound.remark] = inbound.clientStats?.length || 0;
        }
      }),
    );

    return loads;
  }
}

