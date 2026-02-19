import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import {
  Subscription,
  SubscriptionStatus,
  SubscriptionSource,
  XuiServer,
  XuiServerStatus,
} from '@database/entities';
import { ServerPoolsService } from '@modules/server-pools';
import { XuiApiService } from '@modules/xui-api';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';

/**
 * Результат получения подписки с метаданными
 */
export interface SubscriptionResult {
  content: string; // base64 encoded VLESS links
  expireTimestamp: number; // Unix timestamp
  totalTraffic: number; // 0 = unlimited
  usedTraffic: number;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(XuiServer)
    private readonly xuiServerRepo: Repository<XuiServer>,
    private readonly serverPoolsService: ServerPoolsService,
    private readonly xuiApi: XuiApiService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Создать подписку для клиента.
   * 1. Генерировать или использовать переданный clientId
   * 2. Создать клиента на всех активных XUI серверах (бессрочно)
   * 3. Создать запись подписки
   * 4. Вернуть subscription URL
   */
  async createSubscription(dto: CreateSubscriptionDto): Promise<{
    subscriptionId: string;
    clientId: string;
    subscriptionUrl: string;
    serverResults: { success: string[]; failed: string[] };
  }> {
    // 0. Проверяем, нет ли уже активной подписки (если указан telegramId)
    if (dto.telegramId) {
      const existingSubscriptions = await this.getActiveSubscriptionsByTelegramId(dto.telegramId);
      if (existingSubscriptions.length > 0) {
        throw new Error(`User ${dto.telegramId} already has an active subscription`);
      }
    }

    // 1. Генерировать или использовать переданный clientId
    const clientId = dto.clientId || randomUUID();

    // 2. Создать клиента на всех активных серверах
    const activeServers = await this.serverPoolsService.findAllActiveServers();
    const serverResults = await this.xuiApi.createClientOnAllServers(
      clientId,
      activeServers,
    );

    this.logger.log(
      `Client ${clientId} created on servers: ${serverResults.success.length} ok, ${serverResults.failed.length} failed`,
    );

    // 3. Создать подписку
    const startDate = new Date();
    const endDate = new Date();
    
    // Добавляем указанное количество дней
    endDate.setDate(endDate.getDate() + dto.days);
    this.logger.log(`Creating subscription for ${dto.days} days`);

    const subscription = this.subscriptionRepo.create({
      clientId,
      telegramId: dto.telegramId || null,
      status: SubscriptionStatus.ACTIVE,
      source: dto.source || SubscriptionSource.ADMIN,
      note: dto.note || null,
      days: dto.days,
      startDate,
      endDate,
    });
    await this.subscriptionRepo.save(subscription);

    this.logger.log(
      `Subscription ${subscription.id} created for client ${clientId}, expires ${endDate.toISOString()}`,
    );

    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');

    return {
      subscriptionId: subscription.id,
      clientId,
      subscriptionUrl: `${baseUrl}/sub/${clientId}`,
      serverResults,
    };
  }

  /**
   * Получить все подписки
   */
  async findAll(): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Поиск подписок с фильтрацией
   */
  async search(params: {
    search?: string;
    source?: SubscriptionSource;
  }): Promise<Subscription[]> {
    const query = this.subscriptionRepo.createQueryBuilder('subscription');

    // Фильтр по источнику
    if (params.source) {
      query.andWhere('subscription.source = :source', { source: params.source });
    }

    // Поиск по clientId или note
    if (params.search) {
      query.andWhere(
        '(subscription.clientId ILIKE :search OR subscription.note ILIKE :search)',
        { search: `%${params.search}%` }
      );
    }

    query.orderBy('subscription.createdAt', 'DESC');

    return query.getMany();
  }

  /**
   * Получить URL подписки по ID подписки
   */
  async getSubscriptionUrl(subscriptionId: string): Promise<string> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
    return `${baseUrl}/sub/${subscription.clientId}`;
  }

  /**
   * Получить подписку (VLESS-ссылки) для клиента.
   * Возвращает ВСЕ активные сервера из всех пулов.
   * Формат: base64(lines of vless://) — стандарт для v2raytun, happ и т.д.
   */
  async getSubscriptionContent(clientUuid: string): Promise<SubscriptionResult | null> {
    // Проверяем есть ли активная подписка
    const activeSubscription = await this.subscriptionRepo.findOne({
      where: {
        clientId: clientUuid,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { endDate: 'DESC' },
    });

    if (!activeSubscription) {
      throw new NotFoundException('No active subscription');
    }

    // Получаем ВСЕ пулы со всеми серверами
    const allPools = await this.serverPoolsService.findAllPools();

    const vlessLinks: string[] = [];
    const allActiveServers: XuiServer[] = [];

    for (const pool of allPools) {
      if (!pool.isActive) continue;
      
      // Берём все активные серверы пула
      const activeServers = (pool.servers || []).filter(
        (s) => s.status === XuiServerStatus.ACTIVE,
      );

      allActiveServers.push(...activeServers);

      for (const server of activeServers) {
        const vlessLink = this.xuiApi.buildVlessLink(server, clientUuid, pool.name);
        vlessLinks.push(vlessLink);
      }
    }

    if (vlessLinks.length === 0) {
      this.logger.error(`No VLESS links generated for client ${clientUuid}`);
      return null;
    }

    this.logger.log(`Generated ${vlessLinks.length} VLESS links for client ${clientUuid}`);

    // Получаем статистику трафика со всех серверов
    const trafficStats = await this.xuiApi.getClientTrafficStats(clientUuid, allActiveServers);

    // Возвращаем в формате base64 (стандарт подписок) + метаданные
    return {
      content: Buffer.from(vlessLinks.join('\n')).toString('base64'),
      expireTimestamp: Math.floor(activeSubscription.endDate.getTime() / 1000),
      totalTraffic: 0, // безлимит (0 = unlimited в v2ray клиентах)
      usedTraffic: trafficStats.total, // upload + download в байтах
    };
  }

  /**
   * Обработать истёкшие подписки:
   * 1. Найти все подписки со статусом ACTIVE, у которых endDate <= now
   * 2. Удалить клиентов со всех серверов
   * 3. Обновить статус подписок на EXPIRED
   */
  async processExpiredSubscriptions(): Promise<{
    expired: number;
    clientsRemoved: string[];
  }> {
    const now = new Date();

    const expiredSubs = await this.subscriptionRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThanOrEqual(now),
      },
    });

    if (expiredSubs.length === 0) {
      return { expired: 0, clientsRemoved: [] };
    }

    // Собираем уникальные clientId
    const uniqueClientIds: string[] = [...new Set<string>(expiredSubs.map((s: Subscription) => s.clientId))];
    const clientsRemoved: string[] = [];

    // Для каждого клиента проверяем, нет ли других активных подписок
    const allServers = await this.xuiServerRepo.find({
      where: { status: In([XuiServerStatus.ACTIVE, XuiServerStatus.FAILED]) },
    });

    for (const clientId of uniqueClientIds) {
      // Проверяем что у клиента нет других активных подписок
      const otherActiveSubs = await this.subscriptionRepo.count({
        where: {
          clientId,
          status: SubscriptionStatus.ACTIVE,
          endDate: LessThanOrEqual(now) as any, // исключаем те, что уже истекли
        },
      });

      // Считаем ещё действующие подписки (endDate > now)
      const stillActiveSubs = await this.subscriptionRepo
        .createQueryBuilder('sub')
        .where('sub.clientId = :clientId', { clientId })
        .andWhere('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
        .andWhere('sub.endDate > :now', { now })
        .getCount();

      if (stillActiveSubs === 0) {
        // Удаляем клиента со всех серверов
        const result = await this.xuiApi.deleteClientFromAllServers(clientId, allServers);
        this.logger.log(
          `Removed client ${clientId} from servers: ${result.success.length} ok, ${result.failed.length} failed`,
        );
        clientsRemoved.push(clientId);
      }
    }

    // Обновляем статусы подписок
    await this.subscriptionRepo.update(
      { id: In(expiredSubs.map((s: Subscription) => s.id)) },
      { status: SubscriptionStatus.EXPIRED },
    );

    this.logger.log(
      `Processed ${expiredSubs.length} expired subscriptions, removed ${clientsRemoved.length} clients from servers`,
    );

    return { expired: expiredSubs.length, clientsRemoved };
  }

  /**
   * Получить активные подписки клиента по clientId
   */
  async getActiveSubscriptionsByClientId(clientId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: {
        clientId,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { endDate: 'DESC' },
    });
  }

  /**
   * Получить активные подписки по telegramId
   */
  async getActiveSubscriptionsByTelegramId(telegramId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: {
        telegramId,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { endDate: 'DESC' },
    });
  }

  /**
   * Получить все подписки по telegramId (включая истекшие)
   */
  async getAllSubscriptionsByTelegramId(telegramId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { telegramId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Получить активную подписку по telegramId
   */
  async getActiveSubscriptionByTelegramId(telegramId: string): Promise<Subscription | null> {
    return this.subscriptionRepo.findOne({
      where: { 
        telegramId, 
        status: SubscriptionStatus.ACTIVE 
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Продлить подписку на указанное количество дней
   */
  async extendSubscription(subscriptionId: string, days: number): Promise<Subscription> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    // Продлеваем от текущей даты окончания
    const newEndDate = new Date(subscription.endDate);
    newEndDate.setDate(newEndDate.getDate() + days);

    subscription.endDate = newEndDate;
    subscription.days = subscription.days + days;
    subscription.status = SubscriptionStatus.ACTIVE; // На случай если была истекшей

    await this.subscriptionRepo.save(subscription);

    this.logger.log(
      `Subscription ${subscriptionId} extended by ${days} days. New end date: ${newEndDate.toISOString()}`
    );

    return subscription;
  }

  /**
   * Получить все подписки клиента по UUID
   */
  async getSubscriptionsByClientId(clientId: string): Promise<Subscription[]> {
    return this.subscriptionRepo.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Удалить подписку и клиента со всех серверов (если нет других активных подписок)
   */
  async deleteSubscription(subscriptionId: string): Promise<{
    deleted: boolean;
    clientRemoved: boolean;
    serverResults?: { success: string[]; failed: string[] };
  }> {
    const subscription = await this.subscriptionRepo.findOne({
      where: { id: subscriptionId },
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const clientId = subscription.clientId;

    // Удаляем подписку
    await this.subscriptionRepo.remove(subscription);
    this.logger.log(`Subscription ${subscriptionId} deleted`);

    // Проверяем есть ли другие активные подписки у этого клиента
    const otherActiveSubs = await this.subscriptionRepo.count({
      where: {
        clientId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    // Если других активных подписок нет - удаляем клиента со всех серверов
    if (otherActiveSubs === 0) {
      const allServers = await this.xuiServerRepo.find({
        where: { status: In([XuiServerStatus.ACTIVE, XuiServerStatus.FAILED]) },
      });

      const serverResults = await this.xuiApi.deleteClientFromAllServers(clientId, allServers);
      this.logger.log(
        `Client ${clientId} removed from servers: ${serverResults.success.length} ok, ${serverResults.failed.length} failed`,
      );

      return {
        deleted: true,
        clientRemoved: true,
        serverResults,
      };
    }

    return {
      deleted: true,
      clientRemoved: false,
    };
  }
}
