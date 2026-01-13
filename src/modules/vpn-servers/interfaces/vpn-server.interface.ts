export interface ServerWithLoad {
  id: string;
  currentUsers: number;
  usersLimit: number;
  firstInboundId: number | null;
}

export interface VlessKeyResult {
  vless: string;
  serverId: string;
}

export interface InboundClient {
  id: string;
  email: string;
  flow: string;
  totalGB: number;
  expiryTime: number;
  enable: boolean;
}

export interface ClientStats {
  id: number;
  inboundId: number;
  enable: boolean;
  email: string;
  up: number;
  down: number;
  expiryTime: number;
  total: number;
}

export interface InboundSettings {
  clients: InboundClient[];
}

export interface Inbound {
  id: number;
  remark: string;
  settings: string; // JSON string с InboundSettings
  clientStats?: ClientStats[];
}

export interface InboundsResponse {
  success: boolean;
  obj: Inbound[];
}

export interface ExpiringClient {
  clientId: string;
  email: string;
  expiryTime: number;
  serverId: string;
  inboundId: number;
}

