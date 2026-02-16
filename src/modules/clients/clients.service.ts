import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@database/entities';

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  /**
   * Найти или создать клиента по telegramId
   */
  async findOrCreate(
    telegramId: string,
    username?: string | null,
    firstName?: string | null,
  ): Promise<Client> {
    let client = await this.clientRepo.findOne({ where: { telegramId } });

    if (!client) {
      client = this.clientRepo.create({
        telegramId,
        username: username || null,
        firstName: firstName || null,
      });
      client = await this.clientRepo.save(client);
      this.logger.log(`Created new client: ${client.id} (tg: ${telegramId})`);
    } else if (username && client.username !== username) {
      // Обновляем username если изменился
      client.username = username;
      if (firstName) client.firstName = firstName;
      client = await this.clientRepo.save(client);
    }

    return client;
  }

  /**
   * Найти клиента по UUID
   */
  async findById(id: string): Promise<Client | null> {
    return this.clientRepo.findOne({ where: { id } });
  }

  /**
   * Найти клиента по telegramId
   */
  async findByTelegramId(telegramId: string): Promise<Client | null> {
    return this.clientRepo.findOne({ where: { telegramId } });
  }

  /**
   * Найти клиента по UUID с подписками
   */
  async findByIdWithSubscriptions(id: string): Promise<Client | null> {
    return this.clientRepo.findOne({
      where: { id },
      relations: ['subscriptions'],
    });
  }
}
