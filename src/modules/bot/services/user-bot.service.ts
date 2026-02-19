import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Markup, Telegraf } from "telegraf";
import { PaymentsService, RobokassaService } from "@modules/payments";
import { GoogleSheetsService } from "@modules/google-sheets";
import { SubscriptionsService } from "@modules/subscriptions";
import { SubscriptionSource } from "@database/entities";
import { BotCallbacks } from "../constants/callbacks";
import { BotMessages } from "../constants/messages";
import { MessageContext, CallbackContext } from "../types/context";
import { SubscriptionPlan } from "@common/config";
import { formatDate } from "../utils/format-date";

@Injectable()
export class UserBotService {
  private readonly logger = new Logger(UserBotService.name);
  private readonly bot: Telegraf;

  constructor(
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    @Inject(forwardRef(() => RobokassaService))
    private readonly robokassaService: RobokassaService,
    private readonly googleSheetsService: GoogleSheetsService,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
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
   * Получить планы подписок из конфигурации
   */
  private getPlans(): SubscriptionPlan[] {
    const subscriptionPlans = this.configService.get('subscriptionPlans');
    return subscriptionPlans?.plans || [];
  }

  /**
   * Обработка команды /start
   */
  async handleStart(ctx: MessageContext): Promise<void> {
    const telegramId = ctx.message.from?.id.toString();

    if (!telegramId) {
      await ctx.reply("Ошибка: не удалось получить ваш Telegram ID");
      return;
    }

    // Проверяем наличие ЛЮБЫХ подписок (даже истекших)
    const allSubscriptions = await this.subscriptionsService.getAllSubscriptionsByTelegramId(telegramId);

    if (allSubscriptions.length === 0) {
      // Пользователь новый - показываем кнопку для получения пробного периода
      await this.sendTrialOffer(ctx);
    } else {
      // Пользователь уже был - показываем обычное меню
      await this.sendMainMenu(ctx);
    }
  }

  /**
   * Отправить предложение пробного периода
   */
  async sendTrialOffer(ctx: MessageContext | CallbackContext): Promise<void> {
    const buttons = Markup.inlineKeyboard(
      [
        {
          text: "🎁 Получить пробный период (3 дня)",
          callback_data: BotCallbacks.GetTrial,
        },
      ],
      { columns: 1 }
    );

    const message = `🎉 <b>Добро пожаловать в HyperVPN!</b>\n\n` +
      `Мы дарим вам <b>бесплатный пробный период на 3 дня</b>!\n\n` +
      `✨ Что вы получите:\n` +
      `• Доступ ко всем серверам\n` +
      `• Безлимитный трафик\n` +
      `• Высокую скорость соединения\n\n` +
      `Нажмите кнопку ниже, чтобы активировать пробный период.`;

    await ctx.replyWithPhoto(
      { source: "./assets/hyper-vpn-menu.jpg" },
      {
        caption: message,
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Создать пробную подписку
   */
  async handleGetTrial(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const telegramId = ctx.callbackQuery.from.id.toString();
    const firstName = ctx.callbackQuery.from.first_name || "";
    const username = ctx.callbackQuery.from.username || "";

    // Дополнительная проверка - может пользователь уже использовал пробный период
    const allSubscriptions = await this.subscriptionsService.getAllSubscriptionsByTelegramId(telegramId);

    if (allSubscriptions.length > 0) {
      await ctx.reply(
        "⚠️ Вы уже использовали пробный период. Приобретите подписку для продолжения использования.",
        { parse_mode: 'HTML' }
      );
      await this.sendMainMenu(ctx);
      return;
    }

    try {
      // Создаем пробную подписку на 3 дня
      const result = await this.subscriptionsService.createSubscription({
        telegramId,
        days: 3, // Пробный период на 3 дня
        source: SubscriptionSource.BOT,
      });

      this.logger.log(`Created trial subscription for user ${telegramId}: ${result.subscriptionId}`);

      // Записываем в Google Sheets
      try {
        await this.googleSheetsService.appendRow("Лист3", [
          telegramId,
          firstName,
          username,
          new Date().toISOString(),
          'trial',
        ]);
      } catch (error) {
        this.logger.error("Failed to save user to Google Sheets:", error);
      }

      // Отправляем подписку
      const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
      const subscriptionUrl = `${baseUrl}/sub/${result.clientId}`;
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 3);

      try {
        await ctx.deleteMessage();
      } catch {}

      await ctx.reply(
        `✅ <b>Пробный период активирован!</b>\n\n` +
        `🔗 <b>Ссылка на подписку:</b>\n<code>${subscriptionUrl}</code>\n\n` +
        `📅 <b>Действует до:</b> ${endDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\n` +
        `📱 Скопируйте эту ссылку в ваше VPN-приложение (v2rayNG, Streisand, Happ и др.)\n` +
        `👉 Также доступна в разделе "Моя подписка"`,
        { parse_mode: 'HTML' }
      );

      await this.sendMainMenu(ctx);
    } catch (error) {
      this.logger.error(`Failed to create trial subscription for ${telegramId}:`, error);
      await ctx.reply(
        "⚠️ Произошла ошибка при создании пробной подписки. Обратитесь в поддержку."
      );
    }
  }

  /**
   * Отправить главное меню
   */
  async sendMainMenu(ctx: MessageContext | CallbackContext): Promise<void> {
    // Получаем telegramId в зависимости от типа контекста
    let telegramId: string | undefined;
    if ('message' in ctx && ctx.message?.from) {
      telegramId = ctx.message.from.id.toString();
    } else if ('callbackQuery' in ctx && ctx.callbackQuery?.from) {
      telegramId = ctx.callbackQuery.from.id.toString();
    }

    // Проверяем есть ли активная подписка
    let buttonText = "Приобрести VPN 🛜";
    if (telegramId) {
      const activeSubscription = await this.subscriptionsService.getActiveSubscriptionByTelegramId(telegramId);
      if (activeSubscription) {
        buttonText = "Продлить подписку 🔄";
      }
    }

    const buttons = Markup.inlineKeyboard(
      [
        {
          text: buttonText,
          callback_data: BotCallbacks.Subscriptions,
        },
        { text: "Моя подписка 🔑", callback_data: BotCallbacks.MySubscription },
        {
          text: "Инструкция установки 📍",
          callback_data: BotCallbacks.Instructions,
        },
        { text: "Тех. поддержка ⚠️", url: "https://t.me/hyper_vpn_help" },
      ],
      { columns: 1 }
    );

    await ctx.replyWithPhoto(
      { source: "./assets/hyper-vpn-menu.jpg" },
      {
        caption: BotMessages.welcome,
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Показать подписки
   */
  async showSubscriptions(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const plans = this.getPlans();
    const planButtons = plans.map((plan) => ({
      text: plan.label,
      callback_data: `buy_${plan.months}m`,
    }));

    const buttons = Markup.inlineKeyboard(
      [...planButtons, { text: "⬅️ Назад", callback_data: BotCallbacks.Menu }],
      { columns: 1 }
    );

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.replyWithPhoto(
      { source: "./assets/hyper-vpn-subscriptions.jpg" },
      {
        caption: BotMessages.subscriptions,
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Создать ссылку на оплату
   */
  async createPaymentLink(ctx: CallbackContext, months: number): Promise<void> {
    await ctx.answerCbQuery();

    const plans = this.getPlans();
    const plan = plans.find((p) => p.months === months);

    if (!plan) {
      await ctx.reply("Тариф не найден");
      return;
    }

    const telegramId = ctx.callbackQuery.from.id.toString();
    const firstName = ctx.callbackQuery.from.first_name || "";
    const username = ctx.callbackQuery.from.username || "";

    // Создаём сессию платежа
    const session = await this.paymentsService.createSession({
      telegramId,
      firstName,
      username,
      period: months,
      amount: plan.price,
      ttlMinutes: 30,
    });

    // Генерируем URL для оплаты
    const paymentUrl = this.robokassaService.generatePaymentUrl({
      invId: session.invId,
      amount: plan.price,
      description: `Подписка на сервис на ${months} месяц${months === 1 ? '' : months >= 4 ? 'ев' : 'а'}`,
      orderId: session.id,
    });

    const buttons = Markup.inlineKeyboard([
      { text: "💳 Оплатить", url: paymentUrl },
      { text: "⬅️ Назад", callback_data: BotCallbacks.Subscriptions },
    ]);

    // Выбираем картинку в зависимости от периода
    const imageFile = this.getImageForPeriod(months);

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.replyWithPhoto(
      { source: imageFile },
      {
        caption: BotMessages.paymentLink,
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Показать инструкции
   */
  async showInstructions(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const buttons = Markup.inlineKeyboard(
      [
        { text: "iPhone ", callback_data: BotCallbacks.InstructionsIphone },
        { text: "Android 🤖", callback_data: BotCallbacks.InstructionsAndroid },
        { text: "Компьютер 💻", callback_data: BotCallbacks.InstructionsPc },
        { text: "TV 📺", callback_data: BotCallbacks.InstructionsTv },
        { text: "⬅️ Назад", callback_data: BotCallbacks.Menu },
      ],
      { columns: 1 }
    );

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.replyWithPhoto(
      { source: "./assets/hyper-vpn-instructions.jpg" },
      {
        caption: BotMessages.instructions,
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Показать инструкцию для конкретной платформы
   */
  async showPlatformInstructions(
    ctx: CallbackContext,
    platform: "iphone" | "android" | "pc" | "tv"
  ): Promise<void> {
    await ctx.answerCbQuery();

    const messages: Record<string, string> = {
      iphone: BotMessages.instructionsIphone,
      android: BotMessages.instructionsAndroid,
      pc: BotMessages.instructionsPc,
      tv: BotMessages.instructionsTv,
    };

    const buttons = Markup.inlineKeyboard(
      [
        { text: "🏠 Меню", callback_data: BotCallbacks.Menu },
        { text: "⬅️ Назад", callback_data: BotCallbacks.Instructions },
      ],
      { columns: 2 }
    );

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.replyWithPhoto(
      { source: "./assets/hyper-vpn-instructions.jpg" },
      {
        caption: messages[platform],
        parse_mode: "HTML",
        reply_markup: buttons.reply_markup,
      }
    );
  }

  /**
   * Показать подписку пользователя
   */
  async showMySubscription(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const telegramId = ctx.callbackQuery.from.id.toString();
    const subscriptions = await this.subscriptionsService.getActiveSubscriptionsByTelegramId(telegramId);

    const buttons = Markup.inlineKeyboard([
      { text: "⬅️ Назад", callback_data: BotCallbacks.Menu },
    ]);

    let message: string;

    if (subscriptions.length === 0) {
      message = '🚫 <b>У вас нет активной подписки</b>\n\nПриобретите VPN для доступа к сервису!';
    } else {
      // Берем первую (должна быть одна)
      const subscription = subscriptions[0];
      const baseUrl = this.configService.get<string>('app.baseUrl', 'http://localhost:3000');
      const subscriptionUrl = `${baseUrl}/sub/${subscription.clientId}`;
      
      const endDate = formatDate(new Date(subscription.endDate));

      message = `<b>✅ Ваша подписка активна!</b>\n\n` +
        `📅 <b>Действует до:</b> ${endDate}\n` +
        `🔗 <b>Ссылка на подписку:</b>\n<code>${subscriptionUrl}</code>\n\n` +
        `📱 Скопируйте эту ссылку в ваше VPN-приложение (v2rayNG, Streisand, Happ и др.)`;
    }

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: buttons.reply_markup,
    });
  }

  /**
   * Отправить сообщение пользователям бота
   * @param message Текст сообщения
   * @param telegramId Опционально: ID конкретного пользователя. Если не указан - всем пользователям
   */
  async sendMessage(message: string, telegramId?: string): Promise<{
    sent: number;
    failed: number;
    errors: string[];
  }> {
    if (!this.bot) {
      throw new Error('Bot instance not available');
    }

    const errors: string[] = [];

    // Если указан telegramId - отправляем одному пользователю
    if (telegramId) {
      try {
        await this.bot.telegram.sendMessage(telegramId, message, {
          parse_mode: 'HTML',
        });
        this.logger.log(`Message sent to user ${telegramId}`);
        return { sent: 1, failed: 0, errors: [] };
      } catch (error) {
        const errorMsg = `Failed to send message to ${telegramId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
        return { sent: 0, failed: 1, errors };
      }
    }

    // Иначе - отправляем всем пользователям с активными подписками
    const subscriptions = await this.subscriptionsService.findAll();
    const uniqueTelegramIds = [
      ...new Set(
        subscriptions
          .filter((sub) => sub.telegramId)
          .map((sub) => sub.telegramId as string)
      ),
    ];

    this.logger.log(`Broadcasting message to ${uniqueTelegramIds.length} users...`);

    let sent = 0;
    let failed = 0;

    // Отправляем с небольшими задержками, чтобы не словить rate limit
    for (const userId of uniqueTelegramIds) {
      try {
        await this.bot.telegram.sendMessage(userId, message, {
          parse_mode: 'HTML',
        });
        sent++;
        this.logger.log(`Message sent to user ${userId}`);
        
        // Задержка 50мс между сообщениями
        await new Promise((resolve) => setTimeout(resolve, 50));
      } catch (error) {
        failed++;
        const errorMsg = `Failed to send to ${userId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    this.logger.log(`Broadcast complete: ${sent} sent, ${failed} failed`);
    return { sent, failed, errors };
  }

  /**
   * Отправить уведомление о скором окончании подписки
   */
  async notifySubscriptionExpiringSoon(telegramId: string, endDate: Date): Promise<boolean> {
    try {
      const message = 
        `⚠️ <b>Ваша подписка скоро закончится!</b>\n\n` +
        `📅 Дата окончания: ${endDate.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}\n\n` +
        `💡 Продлите подписку прямо сейчас, чтобы не потерять доступ к VPN!`;

      const buttons = Markup.inlineKeyboard([
        { text: "Продлить подписку 🔄", callback_data: BotCallbacks.Subscriptions },
      ]);

      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup,
      });

      this.logger.log(`Expiring notification sent to user ${telegramId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send expiring notification to ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Отправить зазывающее сообщение пользователю с истекшей подпиской
   */
  async notifyInactiveUser(telegramId: string): Promise<boolean> {
    try {
      const message = 
        `😔 <b>Мы скучаем по вам!</b>\n\n` +
        `Ваша подписка на HyperVPN истекла.\n\n` +
        `🎯 Возобновите подписку и снова наслаждайтесь:\n` +
        `• Быстрым и стабильным соединением\n` +
        `• Доступом ко всем серверам\n` +
        `• Безлимитным трафиком\n\n` +
        `💰 Специальное предложение для вас!`;

      const buttons = Markup.inlineKeyboard([
        { text: "Возобновить подписку 🚀", callback_data: BotCallbacks.Subscriptions },
      ]);

      await this.bot.telegram.sendMessage(telegramId, message, {
        parse_mode: 'HTML',
        reply_markup: buttons.reply_markup,
      });

      this.logger.log(`Reactivation message sent to user ${telegramId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send reactivation message to ${telegramId}:`, error);
      return false;
    }
  }

  /**
   * Получить экземпляр бота для использования в других сервисах
   */
  getBot(): Telegraf {
    return this.bot;
  }

  private getImageForPeriod(months: number): string {
    const images: Record<number, string> = {
      1: "./assets/hyper-vpn-one-m.jpg",
      3: "./assets/hyper-vpn-three-m.jpg",
      6: "./assets/hyper-vpn-six-m.jpg",
      12: "./assets/hyper-vpn-twelwe-m.jpg",
    };
    return images[months] || "./assets/hyper-vpn-menu.jpg";
  }
}
