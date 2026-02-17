import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XuiServer, XuiServerStatus } from '@database/entities';
import {
  XuiInboundsResponse,
  XuiInboundClient,
  XuiInbound,
  XuiInboundSettings,
} from './interfaces/xui-api.interface';

@Injectable()
export class XuiApiService {
  private readonly logger = new Logger(XuiApiService.name);

  constructor(
    @InjectRepository(XuiServer)
    private readonly xuiServerRepo: Repository<XuiServer>,
  ) {}

  // ─── Авторизация ───

  /**
   * Авторизация в панели 3x-ui и получение cookie
   */
  async login(server: XuiServer): Promise<string | null> {
    try {
      const loginUrl = this.buildUrl(server, '/login');
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
      this.logger.error(`Failed to login to server ${server.name} (id=${server.id}):`, error);
      await this.markServerFailed(server);
      return null;
    }
  }

  // ─── Inbounds ───

  /**
   * Получить список inbounds сервера
   */
  async getInbounds(server: XuiServer, cookie: string): Promise<XuiInboundsResponse | null> {
    try {
      const url = this.buildUrl(server, '/panel/api/inbounds/list');
      const response = await fetch(url, {
        method: 'GET',
        headers: { Cookie: cookie },
      });

      if (!response.ok) {
        throw new Error(`Get inbounds failed with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get inbounds from ${server.name}:`, error);
      await this.markServerFailed(server);
      return null;
    }
  }

  // ─── Клиенты ───

  /**
   * Добавить клиента в inbound
   */
  async addClient(
    server: XuiServer,
    inboundId: number,
    client: XuiInboundClient,
    cookie: string,
  ): Promise<boolean> {
    try {
      const url = this.buildUrl(server, '/panel/api/inbounds/addClient');
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
      this.logger.error(`Failed to add client to ${server.name} inbound ${inboundId}:`, error);
      await this.markServerFailedIfDown(server, error);
      return false;
    }
  }

  /**
   * Удалить клиента из inbound по UUID
   */
  async deleteClient(
    server: XuiServer,
    inboundId: number,
    clientUuid: string,
    cookie: string,
  ): Promise<boolean> {
    try {
      const url = this.buildUrl(
        server,
        `/panel/api/inbounds/${inboundId}/delClient/${clientUuid}`,
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: { Cookie: cookie },
      });

      if (!response.ok) {
        throw new Error(`Delete client failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete client ${clientUuid} from ${server.name} inbound ${inboundId}:`,
        error,
      );
      await this.markServerFailedIfDown(server, error);
      return false;
    }
  }

  /**
   * Получить количество активных клиентов на сервере
   */
  async getActiveClientsCount(server: XuiServer): Promise<number | null> {
    const cookie = await this.login(server);
    if (!cookie) return null;

    const inbounds = await this.getInbounds(server, cookie);
    if (!inbounds?.obj) return null;

    return inbounds.obj.reduce(
      (acc, inbound) => acc + (inbound.clientStats?.length || 0),
      0,
    );
  }

  /**
   * Получить первый inbound ID сервера (или использовать сохранённый)
   */
  async resolveInboundId(server: XuiServer, cookie: string): Promise<number | null> {
    if (server.inboundId) return server.inboundId;

    const inbounds = await this.getInbounds(server, cookie);
    if (!inbounds?.obj?.length) return null;

    // Сохраняем найденный inboundId
    const firstId = inbounds.obj[0].id;
    await this.xuiServerRepo.update(server.id, { inboundId: firstId });

    return firstId;
  }

  // ─── VLESS ───

  /**
   * Построить VLESS-ссылку из конфигурации сервера
   * @param server - сервер с настройками VLESS
   * @param clientUuid - UUID клиента
   * @param poolName - название пула (для отображения в клиенте)
   */
  buildVlessLink(server: XuiServer, clientUuid: string, poolName?: string): string {
    const params = new URLSearchParams();
    params.set('type', 'tcp');
    params.set('encryption', 'none');
    params.set('security', server.security);
    params.set('pbk', server.pbk);
    params.set('fp', server.fp);
    params.set('sni', server.sni);
    params.set('sid', server.sid);
    params.set('spx', server.spx);

    if (server.flow) {
      params.set('flow', server.flow);
    }

    // Формат метки: "🇩🇪 Germany | Server-1" или "HyperVPN | Germany"
    const labelText = poolName 
      ? `${poolName} | ${server.name}` 
      : `HyperVPN | ${server.name}`;
    const label = encodeURIComponent(labelText);
    return `vless://${clientUuid}@${server.publicHost}:${server.publicPort}?${params.toString()}#${label}`;
  }

  // ─── Создание/удаление клиента на всех серверах ───

  /**
   * Создать клиента на всех активных серверах во всех инбаундах.
   * Бессрочный период (expiryTime = 0).
   */
  async createClientOnAllServers(
    clientUuid: string,
    activeServers: XuiServer[],
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      activeServers.map(async (server) => {
        try {
          const cookie = await this.login(server);
          if (!cookie) {
            failed.push(server.name);
            return;
          }

          const inboundId = await this.resolveInboundId(server, cookie);
          if (!inboundId) {
            this.logger.warn(`No inbound found for server ${server.name}`);
            failed.push(server.name);
            return;
          }

          const client: XuiInboundClient = {
            id: clientUuid,
            email: `client-${clientUuid.slice(0, 8)}`,
            flow: server.flow || '',
            totalGB: 0,
            expiryTime: 0, // бессрочно
            enable: true,
          };

          const added = await this.addClient(server, inboundId, client, cookie);
          if (added) {
            success.push(server.name);
          } else {
            failed.push(server.name);
          }
        } catch (error) {
          this.logger.error(`Error creating client on ${server.name}:`, error);
          failed.push(server.name);
        }
      }),
    );

    return { success, failed };
  }

  /**
   * Удалить клиента со всех серверов по UUID
   */
  async deleteClientFromAllServers(
    clientUuid: string,
    servers: XuiServer[],
  ): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    await Promise.all(
      servers.map(async (server) => {
        try {
          const cookie = await this.login(server);
          if (!cookie) {
            failed.push(server.name);
            return;
          }

          const inboundId = await this.resolveInboundId(server, cookie);
          if (!inboundId) {
            failed.push(server.name);
            return;
          }

          const deleted = await this.deleteClient(server, inboundId, clientUuid, cookie);
          if (deleted) {
            success.push(server.name);
          } else {
            failed.push(server.name);
          }
        } catch (error) {
          this.logger.error(`Error deleting client from ${server.name}:`, error);
          failed.push(server.name);
        }
      }),
    );

    return { success, failed };
  }

  // ─── Утилиты ───

  /**
   * Построить URL для API-запроса к 3x-ui
   */
  private buildUrl(server: XuiServer, path: string): string {
    const basePath = server.webBasePath ? `/${server.webBasePath}` : '';
    return new URL(`${basePath}${path}`, server.apiUrl).toString();
  }

  /**
   * Пометить сервер как упавший
   */
  private async markServerFailed(server: XuiServer): Promise<void> {
    try {
      await this.xuiServerRepo.update(server.id, {
        status: XuiServerStatus.FAILED,
      });
      this.logger.warn(`Server ${server.name} (id=${server.id}) marked as FAILED`);
    } catch (err) {
      this.logger.error(`Failed to update server status:`, err);
    }
  }

  /**
   * Пометить сервер как упавший только если ошибка похожа на сетевую
   */
  private async markServerFailedIfDown(server: XuiServer, error: any): Promise<void> {
    const message = error?.message || '';
    const isNetworkError =
      message.includes('ECONNREFUSED') ||
      message.includes('ETIMEDOUT') ||
      message.includes('ENOTFOUND') ||
      message.includes('fetch failed') ||
      message.includes('network');

    if (isNetworkError) {
      await this.markServerFailed(server);
    }
  }
}
