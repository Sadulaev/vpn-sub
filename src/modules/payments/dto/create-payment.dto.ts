export interface CreatePaymentDto {
  telegramId: string;
  firstName?: string;
  username?: string;
  period: number;
  amount: number;
  ttlMinutes?: number;
}

