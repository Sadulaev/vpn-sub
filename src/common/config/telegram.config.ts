import { registerAs } from '@nestjs/config';

export interface TelegramConfig {
  userBotToken: string;
}

export default registerAs(
  'telegram',
  (): TelegramConfig => ({
    userBotToken: process.env.TG_USER_BOT_TOKEN || '',
  }),
);

