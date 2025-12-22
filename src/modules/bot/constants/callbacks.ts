/**
 * Колбэки для пользовательского бота
 */
export enum BotCallbacks {
  // Навигация
  Menu = 'menu',
  Back = 'back',

  // Подписки
  Subscriptions = 'subscriptions',
  BuyOneMonth = 'buy_1m',
  BuyThreeMonths = 'buy_3m',
  BuySixMonths = 'buy_6m',
  BuyTwelveMonths = 'buy_12m',

  // Инструкции
  Instructions = 'instructions',
  InstructionsIphone = 'instructions_iphone',
  InstructionsAndroid = 'instructions_android',
  InstructionsPc = 'instructions_pc',
  InstructionsTv = 'instructions_tv',

  // Ключи
  MyKeys = 'my_keys',
}

/**
 * Колбэки для админ-бота
 */
export enum AdminCallbacks {
  Menu = 'admin_menu',
  
  // Рассылка
  BroadcastStart = 'broadcast_start',
  BroadcastToOne = 'broadcast_one',
  
  // Серверы
  ServersList = 'servers_list',
  
  // Генерация ключей
  GenerateKeyMenu = 'generate_key_menu',
  GenerateKey1m = 'generate_1m',
  GenerateKey3m = 'generate_3m',
  GenerateKey6m = 'generate_6m',
  GenerateKey12m = 'generate_12m',
  
  // Управление ботом
  ToggleBot = 'toggle_bot',
}

