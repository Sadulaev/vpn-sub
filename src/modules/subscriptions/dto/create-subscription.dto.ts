import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';

export class CreateSubscriptionDto {
  /** Telegram ID клиента */
  @IsString()
  telegramId!: string;

  /** Telegram username (опционально) */
  @IsString()
  @IsOptional()
  username?: string;

  /** Имя в Telegram (опционально) */
  @IsString()
  @IsOptional()
  firstName?: string;

  /** Период подписки в месяцах */
  @IsInt()
  @Min(1)
  @Max(24)
  months!: number;
}
