import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// ============= APP CONFIG =============
export interface AppConfig {
  port: number;
  nodeEnv: string;
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
  adminBotToken: string;
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

// ============= VPN SERVERS CONFIG =============
export interface VpnServerConfig {
  id: string;
  apiUrl: string;
  webBasePath: string;
  username: string;
  password: string;
  publicHost: string;
  publicPort: number;
  usersLimit: number;
  security: string;
  pbk: string;
  fp: string;
  sni: string;
  sid: string;
  spx: string;
  enabled?: boolean;
}

export interface VpnServersConfig {
  servers: VpnServerConfig[];
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
  vpnServers: VpnServersConfig;
  subscriptionPlans: SubscriptionPlansConfig;
}

// ============= VPN SERVERS LOADER =============
const SERVERS_FILE = join(process.cwd(), 'data', 'servers.json');

function loadServersFromFile(): VpnServerConfig[] {
  try {
    if (!existsSync(SERVERS_FILE)) {
      console.warn(`VPN servers config not found: ${SERVERS_FILE}`);
      return [];
    }

    const content = readFileSync(SERVERS_FILE, 'utf-8');
    const data = JSON.parse(content);

    if (!Array.isArray(data.servers)) {
      console.warn('Invalid servers.json format: "servers" should be an array');
      return [];
    }

    return data.servers.filter((s: VpnServerConfig) => s.enabled !== false);
  } catch (error) {
    console.error('Failed to load VPN servers config:', error);
    return [];
  }
}

// ============= CONFIG FACTORY =============
export default (): Config => ({
  app: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'hyper_vpn',
  },
  telegram: {
    userBotToken: process.env.TG_USER_BOT_TOKEN || '',
    adminBotToken: process.env.TG_ADMIN_BOT_TOKEN || '',
  },
  robokassa: {
    merchantId: process.env.ROBOKASSA_MERCHANT_ID || '',
    password1: process.env.ROBOKASSA_PASSWORD_1 || '',
    password2: process.env.ROBOKASSA_PASSWORD_2 || '',
    testMode: process.env.ROBOKASSA_TEST_MODE === 'true',
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_ID || '',
    clientEmail: process.env.GOOGLE_SA_CLIENT_EMAIL || '',
    privateKey: (process.env.GOOGLE_SA_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  vpnServers: {
    servers: loadServersFromFile(),
  },
  subscriptionPlans: {
    plans: [
      { months: 1, price: 189, label: '1 месяц - 189₽' },
      { months: 3, price: 449, label: '3 месяца - 449₽' },
      { months: 6, price: 699, label: '6 месяцев - 699₽' },
      { months: 12, price: 1499, label: '12 месяцев - 1499₽' },
    ],
  },
});
