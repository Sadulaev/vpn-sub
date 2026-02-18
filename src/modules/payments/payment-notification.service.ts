import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { BotCallbacks } from '@modules/bot/constants/callbacks';

@Injectable()
export class PaymentNotificationService {
  private readonly logger = new Logger(PaymentNotificationService.name);
  private readonly bot: Telegraf;

  constructor(private readonly configService: ConfigService) {
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
   * Уведомить пользователя об успешной оплате
   */
  async notifyPaymentSuccess(
    telegramId: string,
    subscriptionUrl: string,
    period: number,
  ): Promise<void> {
    if (!this.bot) return;

    const periodLabel = this.getPeriodLabel(period);

    const buttons = Markup.inlineKeyboard(
      [
        {
          text: 'Инструкция установки 📍',
          callback_data: BotCallbacks.Instructions,
        },
        {
          text: 'Тех. поддержка ⚠️',
          url: 'https://t.me/hyper_vpn_help',
        },
        {
          text: '🏠 Главное меню',
          callback_data: BotCallbacks.Menu,
        },
      ],
      { columns: 1 },
    );

    const message = `✅ <b>Оплата получена!</b>

Поздравляем с успешной покупкой подписки HyperVPN на <b>${periodLabel}</b>!

🔗 <b>Ссылка на подписку</b> (нажмите, чтобы скопировать):

<code>${subscriptionUrl}</code>

📲 Скопируйте эту ссылку в ваше VPN-приложение (v2rayNG, Streisand, Happ и др.)
👉 Также доступна в разделе "Моя подписка"

📍 Подключите через инструкцию ниже.`;

    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup,
      });
      this.logger.log(`Payment success notification sent to ${telegramId}`);
    } catch (error) {
      this.logger.error(`Failed to send notification to ${telegramId}:`, error);
    }
  }

  /**
   * Уведомить об ошибке генерации ключа
   */
  async notifyKeyGenerationError(telegramId: string): Promise<void> {
    if (!this.bot) return;

    const message = `⚠️ <b>Произошла ошибка</b>

Оплата получена, но возникла проблема с генерацией ключа.
Пожалуйста, обратитесь в поддержку: @hyper_vpn_help`;

    try {
      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(`Failed to send error notification to ${telegramId}:`, error);
    }
  }

  private getPeriodLabel(months: number): string {
    if (months === 1) return '1 месяц';
    if (months >= 2 && months <= 4) return `${months} месяца`;
    return `${months} месяцев`;
  }
}

