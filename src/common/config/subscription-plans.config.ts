import { registerAs } from '@nestjs/config';

export interface SubscriptionPlan {
  months: number;
  price: number;
  label: string;
}

export interface SubscriptionPlansConfig {
  plans: SubscriptionPlan[];
}

// Вынесено в конфигурацию вместо хардкода
export default registerAs(
  'subscriptionPlans',
  (): SubscriptionPlansConfig => ({
    plans: [
      { months: 1, price: 189, label: '1 месяц - 189₽' },
      { months: 3, price: 449, label: '3 месяца - 449₽' },
      { months: 6, price: 699, label: '6 месяцев - 699₽' },
      { months: 12, price: 1499, label: '12 месяцев - 1499₽' },
    ],
  }),
);

