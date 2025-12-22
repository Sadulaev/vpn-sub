import { Context } from 'telegraf';
import { Update, Message, CallbackQuery } from 'telegraf/typings/core/types/typegram';

export interface SessionData {
  status?: string;
  targetTelegramId?: string;
  [key: string]: any;
}

export interface CustomContext extends Context {
  session: SessionData;
  update: Update.CallbackQueryUpdate | Update.MessageUpdate;
}

export interface MessageContext extends CustomContext {
  message: Message.TextMessage & {
    from: {
      id: number;
      first_name?: string;
      username?: string;
    };
  };
}

export interface CallbackContext extends CustomContext {
  callbackQuery: CallbackQuery.DataQuery & {
    from: {
      id: number;
      first_name?: string;
      username?: string;
    };
  };
}

