import { Update, Start, Action, Ctx, On, Command } from 'nestjs-telegraf';
import { AdminBotService } from './services/admin-bot.service';
import { AdminCallbacks } from '@modules/bot/constants/callbacks';
import { MessageContext, CallbackContext } from '@modules/bot/types/context';

@Update()
export class AdminBotUpdate {
  constructor(private readonly adminBotService: AdminBotService) {}

  @Start()
  async onStart(@Ctx() ctx: MessageContext): Promise<void> {
    await this.adminBotService.handleStart(ctx);
  }

  @Command('menu')
  async onMenu(@Ctx() ctx: MessageContext): Promise<void> {
    ctx.session.status = undefined;
    await this.adminBotService.showMainMenu(ctx);
  }

  @Action(AdminCallbacks.Menu)
  async onMenuCallback(@Ctx() ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    ctx.session.status = undefined;
    try {
      await ctx.deleteMessage();
    } catch {}
    await this.adminBotService.showMainMenu(ctx);
  }

  @Action(AdminCallbacks.BroadcastStart)
  async onBroadcastStart(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.startBroadcast(ctx);
  }

  @Action(AdminCallbacks.BroadcastToOne)
  async onBroadcastToOne(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.startBroadcastToOne(ctx);
  }

  @Action(AdminCallbacks.ServersList)
  async onServersList(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.showServersList(ctx);
  }

  @Action(AdminCallbacks.GenerateKeyMenu)
  async onGenerateKeyMenu(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.showGenerateKeyMenu(ctx);
  }

  @Action(AdminCallbacks.GenerateKey1m)
  async onGenerateKey1m(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.generateKey(ctx, 1);
  }

  @Action(AdminCallbacks.GenerateKey3m)
  async onGenerateKey3m(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.generateKey(ctx, 3);
  }

  @Action(AdminCallbacks.GenerateKey6m)
  async onGenerateKey6m(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.generateKey(ctx, 6);
  }

  @Action(AdminCallbacks.GenerateKey12m)
  async onGenerateKey12m(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.generateKey(ctx, 12);
  }

  @Action(AdminCallbacks.ToggleBot)
  async onToggleBot(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.toggleBotState(ctx);
  }

  @Action(AdminCallbacks.DeleteExpiredClients)
  async onDeleteExpired(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.deleteExpiredClients(ctx);
  }

  @Action(AdminCallbacks.NotifyExpiringClients)
  async onNotifyExpiring(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.adminBotService.notifyExpiringClients(ctx);
  }

  /**
   * Обработка текстовых сообщений в зависимости от статуса сессии
   */
  @On('text')
  async onText(@Ctx() ctx: MessageContext): Promise<void> {
    const status = ctx.session?.status;

    switch (status) {
      case 'broadcast_all':
        await this.adminBotService.executeBroadcast(ctx);
        break;

      case 'broadcast_one_wait_id':
        await this.adminBotService.saveTargetIdAndWaitMessage(ctx);
        break;

      case 'broadcast_one_wait_message':
        await this.adminBotService.sendMessageToOne(ctx);
        break;

      default:
        // Игнорируем неизвестные сообщения
        break;
    }
  }

  /**
   * Обработка фото-сообщений для рассылки
   */
  @On('photo')
  async onPhoto(@Ctx() ctx: MessageContext): Promise<void> {
    if (ctx.session?.status === 'broadcast_all') {
      await this.adminBotService.executeBroadcast(ctx);
    }
  }
}

