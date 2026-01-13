import { Injectable, Logger } from '@nestjs/common';
import { Markup } from 'telegraf';
import { VpnServersService } from '@modules/vpn-servers';
import { PaymentsService } from '@modules/payments';
import { BotStateService } from './bot-state.service';
import { BroadcastService } from './broadcast.service';
import { AdminCallbacks } from '@modules/bot/constants/callbacks';
import { MessageContext, CallbackContext } from '@modules/bot/types/context';

const USER_BOT_NAME = 'userBot';

@Injectable()
export class AdminBotService {
  private readonly logger = new Logger(AdminBotService.name);

  constructor(
    private readonly vpnServersService: VpnServersService,
    private readonly paymentsService: PaymentsService,
    private readonly botStateService: BotStateService,
    private readonly broadcastService: BroadcastService,
  ) {}

  /**
   * Обработка команды /start
   */
  async handleStart(ctx: MessageContext): Promise<void> {
    ctx.session.status = undefined;
    await this.showMainMenu(ctx);
  }

  /**
   * Показать главное меню админа
   */
  async showMainMenu(ctx: MessageContext | CallbackContext): Promise<void> {
    const botState = await this.botStateService.getBotState(USER_BOT_NAME);

    const buttons = Markup.inlineKeyboard(
      [
        { text: 'Отправить сообщение всем ✉️', callback_data: AdminCallbacks.BroadcastStart },
        { text: 'Отправить сообщение одному ✉️', callback_data: AdminCallbacks.BroadcastToOne },
        { text: 'Все серверы ℹ️', callback_data: AdminCallbacks.ServersList },
        { text: 'Удалить просроченные 🗑️', callback_data: AdminCallbacks.DeleteExpiredClients },
        { text: 'Уведомить об истечении ⏰', callback_data: AdminCallbacks.NotifyExpiringClients },
        { text: 'Получить ключ 🔑', callback_data: AdminCallbacks.GenerateKeyMenu },
        {
          text: botState.enabled ? 'Выключить бота 🔴' : 'Включить бота 🟢',
          callback_data: AdminCallbacks.ToggleBot,
        },
      ],
      { columns: 1 },
    );

    await ctx.reply('🔧 <b>Админ-панель HyperVPN</b>\n\nВыберите действие:', {
      parse_mode: 'HTML',
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Начать рассылку всем
   */
  async startBroadcast(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    ctx.session.status = 'broadcast_all';

    const buttons = Markup.inlineKeyboard([
      { text: 'Отмена ❌', callback_data: AdminCallbacks.Menu },
    ]);

    await ctx.reply(
      '📝 Отправьте сообщение (текст или фото с подписью), которое будет разослано всем пользователям:',
      { reply_markup: buttons.reply_markup },
    );
  }

  /**
   * Начать отправку одному пользователю
   */
  async startBroadcastToOne(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    ctx.session.status = 'broadcast_one_wait_id';

    const buttons = Markup.inlineKeyboard([
      { text: 'Отмена ❌', callback_data: AdminCallbacks.Menu },
    ]);

    await ctx.reply('📝 Введите Telegram ID пользователя:', {
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Сохранить ID и ждать сообщение
   */
  async saveTargetIdAndWaitMessage(ctx: MessageContext): Promise<void> {
    const text = ctx.message.text;
    ctx.session.status = 'broadcast_one_wait_message';
    ctx.session.targetTelegramId = text;

    const buttons = Markup.inlineKeyboard([
      { text: 'Отмена ❌', callback_data: AdminCallbacks.Menu },
    ]);

    await ctx.reply(`📝 Теперь отправьте сообщение для пользователя ${text}:`, {
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Отправить сообщение одному пользователю
   */
  async sendMessageToOne(ctx: MessageContext): Promise<void> {
    const targetId = ctx.session.targetTelegramId;
    const text = ctx.message.text || '';

    if (!targetId) {
      await ctx.reply('❌ Ошибка: ID пользователя не найден');
      return;
    }

    const success = await this.broadcastService.sendToOne(targetId, text);

    ctx.session.status = undefined;
    ctx.session.targetTelegramId = undefined;

    if (success) {
      await ctx.reply(`✅ Сообщение отправлено пользователю ${targetId}`);
    } else {
      await ctx.reply(`❌ Не удалось отправить сообщение пользователю ${targetId}`);
    }

    await this.showMainMenu(ctx);
  }

  /**
   * Выполнить рассылку всем
   */
  async executeBroadcast(ctx: MessageContext): Promise<void> {
    const text = ctx.message.text || '';
    const photo = (ctx.message as any).photo?.[0]?.file_id;

    await ctx.reply('📤 Начинаю рассылку...');

    const result = await this.broadcastService.broadcast(text, {
      photo,
      parseMode: 'HTML',
    });

    ctx.session.status = undefined;

    await ctx.reply(
      `✅ Рассылка завершена!\n\n` +
        `📊 Результат:\n` +
        `• Успешно: ${result.success}\n` +
        `• Ошибки: ${result.failed}`,
    );

    await this.showMainMenu(ctx);
  }

  /**
   * Показать список серверов с нагрузкой
   */
  async showServersList(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const loads = await this.vpnServersService.getLoadsStatistics();

    let message = '📊 <b>Состояние серверов:</b>\n\n';

    for (const [serverId, inbounds] of Object.entries(loads)) {
      message += `🖥 <b>${serverId}</b>\n`;
      for (const [inboundName, count] of Object.entries(inbounds)) {
        message += `  • ${inboundName}: ${count} пользователей\n`;
      }
      message += '\n';
    }

    if (Object.keys(loads).length === 0) {
      message = '❌ Нет доступных серверов или не удалось получить данные';
    }

    const buttons = Markup.inlineKeyboard([
      { text: '⬅️ Назад', callback_data: AdminCallbacks.Menu },
    ]);

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Показать меню генерации ключей
   */
  async showGenerateKeyMenu(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const buttons = Markup.inlineKeyboard(
      [
        { text: '1 месяц 🔑', callback_data: AdminCallbacks.GenerateKey1m },
        { text: '3 месяца 🔑', callback_data: AdminCallbacks.GenerateKey3m },
        { text: '6 месяцев 🔑', callback_data: AdminCallbacks.GenerateKey6m },
        { text: '1 год 🔑', callback_data: AdminCallbacks.GenerateKey12m },
        { text: '⬅️ Назад', callback_data: AdminCallbacks.Menu },
      ],
      { columns: 1 },
    );

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply('🔑 Выберите срок действия ключа:', {
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Сгенерировать ключ
   */
  async generateKey(ctx: CallbackContext, months: number): Promise<void> {
    await ctx.answerCbQuery();

    const result = await this.vpnServersService.createVlessKey(months);

    const buttons = Markup.inlineKeyboard([
      { text: '⬅️ Меню', callback_data: AdminCallbacks.Menu },
    ]);

    if (!result) {
      await ctx.reply('❌ Не удалось сгенерировать ключ. Проверьте серверы.', {
        reply_markup: buttons.reply_markup,
      });
      return;
    }

    const periodLabel = this.getPeriodLabel(months);

    await ctx.reply(
      `✅ Сгенерирован ключ на <b>${periodLabel}</b>:\n\n` +
        `<pre>${result.vless}</pre>\n\n` +
        `🖥 Сервер: ${result.serverId}`,
      {
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup,
      },
    );
  }

  /**
   * Переключить состояние бота
   */
  async toggleBotState(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const currentState = await this.botStateService.getBotState(USER_BOT_NAME);

    if (currentState.enabled) {
      await this.botStateService.disableBot(USER_BOT_NAME);
      await ctx.reply('🔴 Бот выключен');
    } else {
      await this.botStateService.enableBot(USER_BOT_NAME);
      await ctx.reply('🟢 Бот включен');
    }

    await this.showMainMenu(ctx);
  }

  /**
   * Удалить все просроченные подписки
   */
  async deleteExpiredClients(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    await ctx.reply('🗑️ Удаляю просроченные подписки...');

    const result = await this.vpnServersService.deleteAllExpiredClients();

    const buttons = Markup.inlineKeyboard([
      { text: '⬅️ Меню', callback_data: AdminCallbacks.Menu },
    ]);

    let message = '🗑️ <b>Удаление просроченных подписок</b>\n\n';

    if (result.success.length > 0) {
      message += `✅ <b>Успешно:</b>\n`;
      message += result.success.map((s) => `  • ${s}`).join('\n');
      message += '\n\n';
    }

    if (result.failed.length > 0) {
      message += `❌ <b>Ошибки:</b>\n`;
      message += result.failed.map((f) => `  • ${f}`).join('\n');
    }

    if (result.success.length === 0 && result.failed.length === 0) {
      message += '📭 Нет серверов для обработки';
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Уведомить пользователей об истечении подписки
   */
  async notifyExpiringClients(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    await ctx.reply('⏰ Ищу пользователей с истекающей подпиской...');

    // Получаем клиентов с истекающей подпиской (менее 24 часов)
    const expiringClients = await this.vpnServersService.getExpiringClients(24);

    if (expiringClients.length === 0) {
      const buttons = Markup.inlineKeyboard([
        { text: '⬅️ Меню', callback_data: AdminCallbacks.Menu },
      ]);
      await ctx.reply('✅ Нет пользователей с истекающей подпиской в ближайшие 24 часа', {
        reply_markup: buttons.reply_markup,
      });
      return;
    }

    // Находим связанные платёжные сессии
    const clientIds = expiringClients.map((c) => c.clientId);
    const sessionsMap = await this.paymentsService.findByClientIds(clientIds);

    let notified = 0;
    let notFound = 0;
    let failed = 0;

    for (const client of expiringClients) {
      const session = sessionsMap.get(client.clientId);

      if (!session) {
        notFound++;
        continue;
      }

      const hoursLeft = Math.round((client.expiryTime - Date.now()) / (1000 * 60 * 60));

      const message = `⏰ <b>Ваша подписка HyperVPN скоро истекает!</b>

Осталось менее <b>${hoursLeft} ${this.getHoursLabel(hoursLeft)}</b>.

Чтобы продолжить пользоваться VPN, продлите подписку:
👉 /start

💬 Вопросы? Пишите: @hyper_vpn_help`;

      const sent = await this.broadcastService.sendToOne(session.telegramId, message);

      if (sent) {
        notified++;
      } else {
        failed++;
      }

      // Небольшая задержка между сообщениями
      await this.delay(100);
    }

    const buttons = Markup.inlineKeyboard([
      { text: '⬅️ Меню', callback_data: AdminCallbacks.Menu },
    ]);

    await ctx.reply(
      `⏰ <b>Уведомление об истечении подписки</b>\n\n` +
        `📊 Результат:\n` +
        `• Найдено истекающих: ${expiringClients.length}\n` +
        `• Уведомлено: ${notified}\n` +
        `• Не найдены в БД: ${notFound}\n` +
        `• Ошибки отправки: ${failed}`,
      {
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup,
      },
    );
  }

  private getHoursLabel(hours: number): string {
    if (hours === 1) return 'час';
    if (hours >= 2 && hours <= 4) return 'часа';
    return 'часов';
  }

  private getPeriodLabel(months: number): string {
    if (months === 1) return '1 месяц';
    if (months >= 2 && months <= 4) return `${months} месяца`;
    return `${months} месяцев`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

