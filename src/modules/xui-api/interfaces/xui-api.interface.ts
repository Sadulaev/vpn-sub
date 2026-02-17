/**
 * Интерфейсы для работы с 3x-ui API
 */

export interface XuiInboundClient {
  id: string;
  email: string;
  flow: string;
  totalGB: number;
  expiryTime: number;
  enable: boolean;
}

export interface XuiClientStats {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  expiryTime: number;
  total: number;
}

export interface XuiInboundSettings {
  clients: XuiInboundClient[];
}

export interface XuiInbound {
  id: number;
  remark: string;
  settings: string; // JSON string → XuiInboundSettings
  clientStats?: XuiClientStats[];
}

export interface XuiInboundsResponse {
  success: boolean;
  obj: XuiInbound[];
}

export interface XuiOnlinesResponse {
  success: boolean;
  msg: string;
  obj: string[]; // массив email'ов онлайн клиентов
}
