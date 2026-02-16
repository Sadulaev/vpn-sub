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

