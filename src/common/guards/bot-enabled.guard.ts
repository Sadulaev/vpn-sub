import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { TelegrafExecutionContext } from 'nestjs-telegraf';
import { BotStateService } from '@modules/admin-bot';

/**
 * Guard для проверки, включен ли бот
 * Используется в пользовательском боте
 */
@Injectable()
export class BotEnabledGuard implements CanActivate {
  private readonly logger = new Logger(BotEnabledGuard.name);

  constructor(private readonly botStateService: BotStateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = TelegrafExecutionContext.create(context);
    const telegrafContext = ctx.getContext();

    const isEnabled = await this.botStateService.isBotEnabled('userBot');

    if (!isEnabled) {
      this.logger.debug('Bot is disabled, blocking request');

      try {
        await telegrafContext.reply(
          '⚠️ Бот временно недоступен. Попробуйте позже.',
        );
      } catch (error) {
        this.logger.error('Failed to send disabled message:', error);
      }

      return false;
    }

    return true;
  }
}

