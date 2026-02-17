import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
  XuiServer,
  XuiServerStatus,
} from '@database/entities';
import { ClientsService } from '@modules/clients';
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
    private readonly clientsService: ClientsService,
    private readonly serverPoolsService: ServerPoolsService,
    private readonly xuiApi: XuiApiService,
  ) {}

  /**
   * Создать подписку для клиента.
   * 1. Найти или создать клиента в БД
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
    // 1. Найти или создать клиента
    const client = await this.clientsService.findOrCreate(
      dto.telegramId,
      dto.username,
      dto.firstName,
    );

    // 2. Создать клиента на всех активных серверах
    const activeServers = await this.serverPoolsService.findAllActiveServers();
    const serverResults = await this.xuiApi.createClientOnAllServers(
      client.id,
      activeServers,
    );

    this.logger.log(
      `Client ${client.id} created on servers: ${serverResults.success.length} ok, ${serverResults.failed.length} failed`,
    );

    // 3. Создать подписку
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + dto.months);
    endDate.setDate(endDate.getDate() + 1); // +1 день запаса

    const subscription = this.subscriptionRepo.create({
      clientId: client.id,
      status: SubscriptionStatus.ACTIVE,
      months: dto.months,
      startDate,
      endDate,
    });
    await this.subscriptionRepo.save(subscription);

    this.logger.log(
      `Subscription ${subscription.id} created for client ${client.id}, expires ${endDate.toISOString()}`,
    );

    return {
      subscriptionId: subscription.id,
      clientId: client.id,
      subscriptionUrl: `/sub/${client.id}`,
      serverResults,
    };
  }

  /**
   * Получить подписку (VLESS-ссылки) для клиента.
   * Возвращает ВСЕ активные сервера из всех пулов.
   * Формат: base64(lines of vless://) — стандарт для v2raytun, happ и т.д.
   */
  async getSubscriptionContent(clientUuid: string): Promise<SubscriptionResult | null> {
    // Проверяем что клиент существует
    const client = await this.clientsService.findById(clientUuid);
    if (!client) {
      throw new NotFoundException('Client not found');
    }

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

    for (const pool of allPools) {
      if (!pool.isActive) continue;
      
      // Берём все активные серверы пула
      const activeServers = (pool.servers || []).filter(
        (s) => s.status === XuiServerStatus.ACTIVE,
      );

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

    // Возвращаем в формате base64 (стандарт подписок) + метаданные
    return {
      content: Buffer.from(vlessLinks.join('\n')).toString('base64'),
      expireTimestamp: Math.floor(activeSubscription.endDate.getTime() / 1000),
      totalTraffic: 0, // безлимит
      usedTraffic: 0,
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
      relations: ['client'],
    });

    if (expiredSubs.length === 0) {
      return { expired: 0, clientsRemoved: [] };
    }

    // Собираем уникальные clientId
    const uniqueClientIds = [...new Set(expiredSubs.map((s) => s.clientId))];
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
      { id: In(expiredSubs.map((s) => s.id)) },
      { status: SubscriptionStatus.EXPIRED },
    );

    this.logger.log(
      `Processed ${expiredSubs.length} expired subscriptions, removed ${clientsRemoved.length} clients from servers`,
    );

    return { expired: expiredSubs.length, clientsRemoved };
  }

  /**
   * Получить активные подписки клиента по telegramId
   */
  async getActiveSubscriptionsByTelegramId(telegramId: string): Promise<Subscription[]> {
    const client = await this.clientsService.findByTelegramId(telegramId);
    if (!client) return [];

    return this.subscriptionRepo.find({
      where: {
        clientId: client.id,
        status: SubscriptionStatus.ACTIVE,
      },
      order: { endDate: 'DESC' },
    });
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
}
