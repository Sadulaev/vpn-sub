import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Markup } from "telegraf";
import { User } from "@database/entities";
import { PaymentsService, RobokassaService } from "@modules/payments";
import { GoogleSheetsService } from "@modules/google-sheets";
import { BotCallbacks } from "../constants/callbacks";
import { BotMessages } from "../constants/messages";
import { MessageContext, CallbackContext } from "../types/context";
import { SubscriptionPlan } from "@common/config";
import { formatDate } from "../utils/format-date";

@Injectable()
export class UserBotService {
  private readonly logger = new Logger(UserBotService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly paymentsService: PaymentsService,
    private readonly robokassaService: RobokassaService,
    private readonly googleSheetsService: GoogleSheetsService
  ) {}

  /**
   * Получить планы подписок из конфигурации
   */
  private getPlans(): SubscriptionPlan[] {
    return (
      this.configService.get<SubscriptionPlan[]>("subscriptionPlans.plans") ||
      []
    );
  }

  /**
   * Обработка команды /start
   */
  async handleStart(ctx: MessageContext): Promise<void> {
    const telegramId = ctx.message.from?.id.toString();
    const firstName = ctx.message.from?.first_name || "";
    const username = ctx.message.from?.username || "";

    // Сохраняем/обновляем пользователя
    let user = await this.userRepository.findOne({ where: { telegramId } });

    if (!user) {
      user = this.userRepository.create({
        telegramId,
        firstName,
        username,
      });
      await this.userRepository.save(user);

      // Записываем в Google Sheets
      if (telegramId) {
        try {
          await this.googleSheetsService.appendRow("Лист3", [
            telegramId,
            firstName,
            username,
          ]);
        } catch (error) {
          this.logger.error("Failed to save user to Google Sheets:", error);
        }
      }
    }

    await this.sendMainMenu(ctx);
  }

  /**
   * Отправить главное меню
   */
  async sendMainMenu(ctx: MessageContext | CallbackContext): Promise<void> {
    const buttons = Markup.inlineKeyboard(
      [
        {
          text: "Приобрести VPN 🛜",
          callback_data: BotCallbacks.Subscriptions,
        },
        { text: "Мои ключи 🔑", callback_data: BotCallbacks.MyKeys },
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
      description: `HyperVPN ${plan.label}`,
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
   * Показать ключи пользователя
   */
  async showMyKeys(ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();

    const telegramId = ctx.callbackQuery.from.id.toString();
    const sessions =
      await this.paymentsService.getActiveKeysByTelegramId(telegramId);

    const buttons = Markup.inlineKeyboard([
      { text: "⬅️ Назад", callback_data: BotCallbacks.Menu },
    ]);

    let message: string;

    if (sessions.length === 0) {
      message = BotMessages.noActiveKeys;
    } else {
      const keysText = sessions
        .map((session, index) => {
          const createdAt = formatDate(session.createdAt);
          const expiresAt = session.keyExpiresAt
            ? formatDate(session.keyExpiresAt)
            : "Неизвестно";

          return `
<b>Ключ ${index + 1}</b>
<pre>${session.vlessKey}</pre>
📅 Создан: ${createdAt}
⏳ Действует до: ${expiresAt}`;
        })
        .join("\n");

      message = `${BotMessages.activeKeysHeader}\n${keysText}`;
    }

    try {
      await ctx.deleteMessage();
    } catch {}

    await ctx.reply(message, {
      parse_mode: "HTML",
      reply_markup: buttons.reply_markup,
    });
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
