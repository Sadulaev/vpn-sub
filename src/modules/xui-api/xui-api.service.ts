import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { XuiServer, XuiServerStatus, Subscription, SubscriptionStatus } from '@database/entities';
import {
  XuiInboundsResponse,
  XuiInboundClient,
  XuiInbound,
  XuiInboundSettings,
  XuiOnlinesResponse,
} from './interfaces/xui-api.interface';

@Injectable()
export class XuiApiService {
  private readonly logger = new Logger(XuiApiService.name);

  constructor(
    @InjectRepository(XuiServer)
    private readonly xuiServerRepo: Repository<XuiServer>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
  ) {}

  // ─── Вспомогательные методы ───

  /**
   * Задержка выполнения
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry механизм с экспоненциальной задержкой
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          this.logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Выполнить задачи с ограничением параллелизма
   */
  private async processWithConcurrencyLimit<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    concurrencyLimit: number,
  ): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    
    for (let i = 0; i < items.length; i += concurrencyLimit) {
      const chunk = items.slice(i, i + concurrencyLimit);
      const chunkResults = await Promise.allSettled(
        chunk.map(item => processor(item))
      );
      results.push(...chunkResults);
      
      // Небольшая задержка между чанками для снижения нагрузки
      if (i + concurrencyLimit < items.length) {
        await this.sleep(200);
      }
    }
    
    return results;
  }

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
    retries: number = 3,
  ): Promise<boolean> {
    try {
      return await this.retryWithBackoff(async () => {
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
          // Для ошибок 500/429 (перегрузка) имеет смысл повторить
          if (response.status === 500 || response.status === 429) {
            throw new Error(`Server overloaded (${response.status}), will retry`);
          }
          throw new Error(`Add client failed with status: ${response.status}`);
        }

        return true;
      }, retries);
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
   * Получить список онлайн клиентов на сервере
   */
  async getOnlineClients(server: XuiServer, cookie: string): Promise<XuiOnlinesResponse | null> {
    try {
      const url = this.buildUrl(server, '/panel/api/inbounds/onlines');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 
          'Cookie': cookie,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        this.logger.warn(`Get onlines failed with status: ${response.status}, trying fallback method`);
      }

      const data = await response.json();
      this.logger.debug(`Online clients response from ${server.name}:`, JSON.stringify(data));
      return data;
    } catch (error) {
      this.logger.error(`Failed to get online clients from ${server.name}:`, error);
      return null;
    }
  }

  /**
   * Получить количество уникальных активных клиентов из БД
   */
  async getActiveClientsCountFromDB(): Promise<number> {
    const activeSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
    });
    
    // Удаляем дубликаты clientId
    const uniqueClientIds = new Set(activeSubscriptions.map(sub => sub.clientId));
    return uniqueClientIds.size;
  }

  /**
   * Получить количество активных (онлайн) клиентов на сервере.
   * Использует endpoint /panel/api/inbounds/onlines для получения
   * реального списка подключённых пользователей.
   */
  async getActiveClientsCount(server: XuiServer): Promise<number | null> {
    const cookie = await this.login(server);
    if (!cookie) return null;

    const onlines = await this.getOnlineClients(server, cookie);
    if (!onlines || !onlines.success) return null;

    return onlines.obj.length;
  }

  /**
   * Получить статистику трафика клиента со всех серверов.
   * Суммирует upload и download со всех 3x-ui серверов.
   * @param clientUuid - UUID клиента
   * @param servers - список серверов для опроса
   * @returns {upload: bytes, download: bytes, total: upload + download}
   */
  async getClientTrafficStats(clientUuid: string, servers: XuiServer[]): Promise<{
    upload: number;
    download: number;
    total: number;
  }> {
    let totalUpload = 0;
    let totalDownload = 0;

    await Promise.all(
      servers.map(async (server) => {
        try {
          const cookie = await this.login(server);
          if (!cookie) return;

          const inbounds = await this.getInbounds(server, cookie);
          if (!inbounds?.obj) return;

          // Ищем статистику клиента во всех inbound-ах
          for (const inbound of inbounds.obj) {
            if (!inbound.clientStats) continue;

            const clientStat = inbound.clientStats.find(
              (stat) => stat.email === `client-${clientUuid.slice(0, 8)}` || 
                        stat.email.includes(clientUuid.slice(0, 8)),
            );

            if (clientStat) {
              totalUpload += clientStat.up || 0;
              totalDownload += clientStat.down || 0;
              this.logger.debug(
                `Client ${clientUuid.slice(0, 8)} on ${server.name}: ↑${clientStat.up} ↓${clientStat.down}`,
              );
            }
          }
        } catch (error) {
          this.logger.error(`Failed to get stats from ${server.name}:`, error);
        }
      }),
    );

    const total = totalUpload + totalDownload;
    this.logger.log(
      `Client ${clientUuid.slice(0, 8)} total traffic: ↑${totalUpload} ↓${totalDownload} (${total} bytes)`,
    );

    return {
      upload: totalUpload,
      download: totalDownload,
      total,
    };
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

  /**
   * Синхронизировать всех активных клиентов на новый сервер
   * Используется при добавлении нового сервера в систему
   * 
   * @param server - Новый сервер для синхронизации
   * @param batchSize - Размер батча (default: 10, уменьшено для предотвращения перегрузки сервера)
   * @param concurrencyLimit - Максимальное кол-во параллельных запросов в батче (default: 3)
   * @param delayBetweenBatchesMs - Задержка между батчами в мс (default: 1500)
   * @returns Статистика синхронизации
   */
  async syncAllActiveClientsToServer(
    server: XuiServer,
    batchSize: number = 10,
    concurrencyLimit: number = 3,
    delayBetweenBatchesMs: number = 1500,
  ): Promise<{ total: number; success: number; failed: number; errors: string[] }> {
    this.logger.log(`Starting sync of all active clients to server ${server.name} (id=${server.id})...`);
    this.logger.log(`Settings: batchSize=${batchSize}, concurrency=${concurrencyLimit}, delay=${delayBetweenBatchesMs}ms`);

    // Получаем всех клиентов с активными подписками
    const activeSubscriptions = await this.subscriptionRepo.find({
      where: { status: SubscriptionStatus.ACTIVE },
    });

    // Удаляем дубликаты clientId (если у одного клиента несколько активных подписок)
    const uniqueClientIds: string[] = [...new Set(activeSubscriptions.map((sub: Subscription) => sub.clientId))];
    const total = uniqueClientIds.length;

    if (total === 0) {
      this.logger.log(`No active clients found for sync to ${server.name}`);
      return { total: 0, success: 0, failed: 0, errors: [] };
    }

    this.logger.log(`Found ${total} unique active clients to sync to ${server.name}`);

    // Авторизуемся на сервере
    const cookie = await this.login(server);
    if (!cookie) {
      const error = `Failed to login to server ${server.name}`;
      this.logger.error(error);
      return { total, success: 0, failed: total, errors: [error] };
    }

    // Получаем inbound ID
    const inboundId = await this.resolveInboundId(server, cookie);
    if (!inboundId) {
      const error = `No inbound found for server ${server.name}`;
      this.logger.error(error);
      return { total, success: 0, failed: total, errors: [error] };
    }

    // Получаем существующих клиентов на сервере
    const inboundsResponse = await this.getInbounds(server, cookie);
    if (!inboundsResponse) {
      const error = `Failed to get inbounds from server ${server.name}`;
      this.logger.error(error);
      return { total, success: 0, failed: total, errors: [error] };
    }

    const targetInbound = inboundsResponse.obj.find(inb => inb.id === inboundId);
    const existingClientIds = new Set<string>();
    
    if (targetInbound) {
      try {
        const settings: XuiInboundSettings = JSON.parse(targetInbound.settings);
        settings.clients.forEach(client => existingClientIds.add(client.id));
        this.logger.log(`Found ${existingClientIds.size} existing clients on server ${server.name}`);
      } catch (error) {
        this.logger.warn(`Failed to parse inbound settings for server ${server.name}:`, error);
      }
    }

    // Фильтруем только тех клиентов, которых нет на сервере
    const clientsToAdd = uniqueClientIds.filter(id => !existingClientIds.has(id));
    
    this.logger.log(`Need to add ${clientsToAdd.length} new clients to ${server.name} (${existingClientIds.size} already exist)`);

    if (clientsToAdd.length === 0) {
      this.logger.log(`All active clients already exist on server ${server.name}`);
      return { total, success: total, failed: 0, errors: [] };
    }

    // Батчевая обработка клиентов
    let successCount = existingClientIds.size;
    let failedCount = 0;
    const errors: string[] = [];

    // Разбиваем на батчи
    for (let i = 0; i < clientsToAdd.length; i += batchSize) {
      const batch = clientsToAdd.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(clientsToAdd.length / batchSize);

      this.logger.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} clients)...`);

      // Добавляем клиентов с ограничением параллелизма
      const results = await this.processWithConcurrencyLimit(
        batch,
        async (clientId: string) => {
          const xuiClient: XuiInboundClient = {
            id: clientId,
            email: `client-${clientId.slice(0, 8)}`,
            flow: server.flow || '',
            totalGB: 0,
            expiryTime: 0, // бессрочно
            enable: true,
          };

          const added = await this.addClient(server, inboundId, xuiClient, cookie);
          if (!added) {
            throw new Error(`Failed to add client ${clientId}`);
          }
          return clientId;
        },
        concurrencyLimit,
      );

      // Подсчитываем результаты батча
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          successCount++;
        } else {
          failedCount++;
          const clientId: string = batch[idx];
          const errorMsg = `Client ${clientId.slice(0, 8)}: ${result.reason?.message || 'Unknown error'}`;
          errors.push(errorMsg);
        }
      });

      this.logger.log(
        `Batch ${batchNum}/${totalBatches} completed. Success: ${results.filter(r => r.status === 'fulfilled').length}, Failed: ${results.filter(r => r.status === 'rejected').length}`,
      );

      // Задержка между батчами для снижения нагрузки на сервер
      if (i + batchSize < clientsToAdd.length) {
        this.logger.log(`Waiting ${delayBetweenBatchesMs}ms before next batch...`);
        await this.sleep(delayBetweenBatchesMs);
      }
    }

    this.logger.log(
      `Sync to ${server.name} completed. Total: ${total}, Success: ${successCount}, Failed: ${failedCount}`,
    );

    return { total, success: successCount, failed: failedCount, errors };
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
