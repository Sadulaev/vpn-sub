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

export interface Inbound {
  id: number;
  remark: string;
  clientStats?: { id: string }[];
}

export interface InboundsResponse {
  success: boolean;
  obj: Inbound[];
}

