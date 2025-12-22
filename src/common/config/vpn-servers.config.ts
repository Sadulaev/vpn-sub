import { registerAs } from '@nestjs/config';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

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

export default registerAs('vpnServers', (): VpnServersConfig => ({
  servers: loadServersFromFile(),
}));
