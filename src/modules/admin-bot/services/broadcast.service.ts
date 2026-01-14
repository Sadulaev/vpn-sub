import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Telegraf } from 'telegraf';
import { User } from '@database/entities';
import { GoogleSheetsService } from '@modules/google-sheets';

interface BroadcastOptions {
  photo?: string;
  parseMode?: 'HTML' | 'Markdown';
}

@Injectable()
export class BroadcastService {
  private readonly logger = new Logger(BroadcastService.name);
  private readonly bot: Telegraf;
  private readonly delayMs = 50; // Задержка между сообщениями для избежания rate limit

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {
    const telegram = this.configService.get('telegram');
    const token = telegram?.userBotToken;
    if (token) {
      this.bot = new Telegraf(token);
    } else {
      this.logger.warn('User bot token not configured');
      this.bot = null as any;
    }
  }

  /**
   * Получить все уникальные ID пользователей из БД и Google Sheets
   */
  async getAllUserIds(): Promise<string[]> {
    const dbUsers = await this.userRepository.find({ select: ['telegramId'] });
    const dbIds = dbUsers.map((u) => u.telegramId);

    let sheetIds: string[] = [];
    try {
      sheetIds = await this.googleSheetsService.getUniqueTelegramIds();
    } catch (error) {
      this.logger.error('Failed to get IDs from Google Sheets:', error);
    }

    // Объединяем и убираем дубликаты
    return [...new Set([...dbIds, ...sheetIds])];
  }

  /**
   * Отправить сообщение одному пользователю
   */
  async sendToOne(
    telegramId: string,
    text: string,
    options?: BroadcastOptions,
  ): Promise<boolean> {
    if (!this.bot) return false;

    try {
      if (options?.photo) {
        await this.bot.telegram.sendPhoto(telegramId, options.photo, {
          caption: text,
          parse_mode: options.parseMode || 'HTML',
        });
      } else {
        await this.bot.telegram.sendMessage(telegramId, text, {
          parse_mode: options?.parseMode || 'HTML',
        });
      }
      return true;
    } catch (error) {
      this.logger.error(`Failed to send message to ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Рассылка сообщения всем пользователям
   */
  async broadcast(
    text: string,
    options?: BroadcastOptions,
  ): Promise<{ success: number; failed: number }> {
    if (!this.bot) {
      return { success: 0, failed: 0 };
    }

    const userIds = await this.getAllUserIds();
    let success = 0;
    let failed = 0;

    for (const telegramId of userIds) {
      const sent = await this.sendToOne(telegramId, text, options);
      if (sent) {
        success++;
      } else {
        failed++;
      }

      // Небольшая задержка для избежания rate limit
      await this.delay(this.delayMs);
    }

    this.logger.log(`Broadcast completed: ${success} success, ${failed} failed`);
    return { success, failed };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

