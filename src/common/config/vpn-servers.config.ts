import { registerAs } from '@nestjs/config';

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

export default registerAs('vpnServers', (): VpnServersConfig => {
  const configJson = process.env.VPN_SERVERS_CONFIG || '[]';
  try {
    const servers = JSON.parse(configJson) as VpnServerConfig[];
    return {
      servers: servers.filter((s) => s.enabled !== false),
    };
  } catch {
    console.error('Failed to parse VPN_SERVERS_CONFIG');
    return { servers: [] };
  }
});

