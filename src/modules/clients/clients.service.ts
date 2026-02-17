import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '@database/entities';
import { CreateClientDto, UpdateClientDto } from './dto';

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
   * Создать нового клиента
   */
  async create(dto: CreateClientDto): Promise<Client> {
    const client = this.clientRepo.create({
      telegramId: dto.telegramId,
      username: dto.username || null,
      firstName: dto.firstName || null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.clientRepo.save(client);
    this.logger.log(`Created new client: ${saved.id} (tg: ${dto.telegramId})`);
    return saved;
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

  /**
   * Обновить данные клиента
   */
  async update(id: string, dto: UpdateClientDto): Promise<Client> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    if (dto.username !== undefined) client.username = dto.username;
    if (dto.firstName !== undefined) client.firstName = dto.firstName;
    if (dto.isActive !== undefined) client.isActive = dto.isActive;

    const updated = await this.clientRepo.save(client);
    this.logger.log(`Updated client: ${updated.id} (tg: ${updated.telegramId})`);
    return updated;
  }

  /**
   * Удалить клиента
   */
  async delete(id: string): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException(`Client with ID ${id} not found`);
    }

    await this.clientRepo.remove(client);
    this.logger.log(`Deleted client: ${id} (tg: ${client.telegramId})`);
  }
}
