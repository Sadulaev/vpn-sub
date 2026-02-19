// ============= APP CONFIG =============
export interface AppConfig {
  port: number;
  nodeEnv: string;
  baseUrl: string;
}

// ============= DATABASE CONFIG =============
export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

// ============= TELEGRAM CONFIG =============
export interface TelegramConfig {
  userBotToken: string;
}

// ============= ROBOKASSA CONFIG =============
export interface RobokassaConfig {
  merchantId: string;
  password1: string;
  password2: string;
  testMode: boolean;
}

// ============= GOOGLE SHEETS CONFIG =============
export interface GoogleSheetsConfig {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
}

// ============= SUBSCRIPTION PLANS CONFIG =============
export interface SubscriptionPlan {
  months: number;
  price: number;
  label: string;
}

export interface SubscriptionPlansConfig {
  plans: SubscriptionPlan[];
}

// ============= MAIN CONFIG =============
export interface Config {
  app: AppConfig;
  database: DatabaseConfig;
  telegram: TelegramConfig;
  robokassa: RobokassaConfig;
  googleSheets: GoogleSheetsConfig;
  subscriptionPlans: SubscriptionPlansConfig;
}

// ============= CONFIG FACTORY =============
export default (): Config => ({
  app: {
    port: parseInt(process.env.PORT || "3000", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
  },
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "vpn",
    password: process.env.DB_PASSWORD || "neron",
    database: process.env.DB_NAME || "hyper_vpn",
  },
  telegram: {
    userBotToken: process.env.TG_USER_BOT_TOKEN || "",
  },
  robokassa: {
    merchantId: process.env.ROBOKASSA_MERCHANT_ID || "",
    password1: process.env.ROBOKASSA_PASSWORD_1 || "",
    password2: process.env.ROBOKASSA_PASSWORD_2 || "",
    testMode: process.env.ROBOKASSA_TEST_MODE === "true",
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_ID || "",
    clientEmail: process.env.GOOGLE_SA_CLIENT_EMAIL || "",
    privateKey: (process.env.GOOGLE_SA_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  },
  subscriptionPlans: {
    plans: [
      { months: 1, price: 189, label: '1 месяц - 189₽' },
      { months: 3, price: 449, label: '3 месяца - 449₽' },
      { months: 6, price: 699, label: '6 месяцев - 699₽' },
      { months: 12, price: 1499, label: '12 месяцев - 1499₽' },
      // { months: 1, price: 1, label: "1 месяц - 1₽" },
      // { months: 3, price: 2, label: "3 месяца - 2₽" },
      // { months: 6, price: 3, label: "6 месяцев - 3₽" },
      // { months: 12, price: 4, label: "12 месяцев - 4₽" },
    ],
  },
});
