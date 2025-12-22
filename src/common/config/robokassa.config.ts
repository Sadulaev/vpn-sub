import { registerAs } from '@nestjs/config';

export interface RobokassaConfig {
  merchantId: string;
  password1: string;
  password2: string;
  testMode: boolean;
}

export default registerAs(
  'robokassa',
  (): RobokassaConfig => ({
    merchantId: process.env.ROBOKASSA_MERCHANT_ID || '',
    password1: process.env.ROBOKASSA_PASSWORD_1 || '',
    password2: process.env.ROBOKASSA_PASSWORD_2 || '',
    testMode: process.env.ROBOKASSA_TEST_MODE === 'true',
  }),
);

