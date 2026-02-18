import { Update, Start, Action, Ctx, Command } from 'nestjs-telegraf';
import { UserBotService } from './services/user-bot.service';
import { BotCallbacks } from './constants/callbacks';
import { MessageContext, CallbackContext } from './types/context';

@Update()
export class UserBotUpdate {
  constructor(private readonly botService: UserBotService) {}

  @Start()
  async onStart(@Ctx() ctx: MessageContext): Promise<void> {
    await this.botService.handleStart(ctx);
  }

  @Command('menu')
  async onMenu(@Ctx() ctx: MessageContext): Promise<void> {
    await this.botService.sendMainMenu(ctx);
  }

  @Action(BotCallbacks.Menu)
  async onMenuCallback(@Ctx() ctx: CallbackContext): Promise<void> {
    await ctx.answerCbQuery();
    try {
      await ctx.deleteMessage();
    } catch {}
    await this.botService.sendMainMenu(ctx);
  }

  @Action(BotCallbacks.Subscriptions)
  async onSubscriptions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showSubscriptions(ctx);
  }

  @Action(BotCallbacks.BuyOneMonth)
  async onBuyOneMonth(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.createPaymentLink(ctx, 1);
  }

  @Action(BotCallbacks.BuyThreeMonths)
  async onBuyThreeMonths(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.createPaymentLink(ctx, 3);
  }

  @Action(BotCallbacks.BuySixMonths)
  async onBuySixMonths(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.createPaymentLink(ctx, 6);
  }

  @Action(BotCallbacks.BuyTwelveMonths)
  async onBuyTwelveMonths(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.createPaymentLink(ctx, 12);
  }

  @Action(BotCallbacks.Instructions)
  async onInstructions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showInstructions(ctx);
  }

  @Action(BotCallbacks.InstructionsIphone)
  async onIphoneInstructions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showPlatformInstructions(ctx, 'iphone');
  }

  @Action(BotCallbacks.InstructionsAndroid)
  async onAndroidInstructions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showPlatformInstructions(ctx, 'android');
  }

  @Action(BotCallbacks.InstructionsPc)
  async onPcInstructions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showPlatformInstructions(ctx, 'pc');
  }

  @Action(BotCallbacks.InstructionsTv)
  async onTvInstructions(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showPlatformInstructions(ctx, 'tv');
  }

  @Action(BotCallbacks.MySubscription)
  async onMySubscription(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.showMySubscription(ctx);
  }

  @Action(BotCallbacks.GetTrial)
  async onGetTrial(@Ctx() ctx: CallbackContext): Promise<void> {
    await this.botService.handleGetTrial(ctx);
  }
}

