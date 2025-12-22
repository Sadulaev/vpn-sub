import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotState } from '@database/entities';

@Injectable()
export class BotStateService {
  private readonly logger = new Logger(BotStateService.name);

  constructor(
    @InjectRepository(BotState)
    private readonly botStateRepository: Repository<BotState>,
  ) {}

  /**
   * Получить состояние бота по имени
   */
  async getBotState(name: string): Promise<BotState> {
    let state = await this.botStateRepository.findOne({ where: { name } });

    if (!state) {
      state = this.botStateRepository.create({
        name,
        enabled: true,
      });
      state = await this.botStateRepository.save(state);
    }

    return state;
  }

  /**
   * Включить бота
   */
  async enableBot(name: string): Promise<BotState> {
    const state = await this.getBotState(name);
    state.enabled = true;
    return this.botStateRepository.save(state);
  }

  /**
   * Выключить бота
   */
  async disableBot(name: string): Promise<BotState> {
    const state = await this.getBotState(name);
    state.enabled = false;
    return this.botStateRepository.save(state);
  }

  /**
   * Проверить, включен ли бот
   */
  async isBotEnabled(name: string): Promise<boolean> {
    const state = await this.getBotState(name);
    return state.enabled;
  }
}

