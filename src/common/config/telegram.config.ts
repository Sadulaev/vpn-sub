import { registerAs } from '@nestjs/config';

export interface TelegramConfig {
  userBotToken: string;
  adminBotToken: string;
}

export default registerAs(
  'telegram',
  (): TelegramConfig => ({
    userBotToken: process.env.TG_USER_BOT_TOKEN || '',
    adminBotToken: process.env.TG_ADMIN_BOT_TOKEN || '',
  }),
);

