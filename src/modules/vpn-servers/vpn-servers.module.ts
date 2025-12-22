import { Module } from '@nestjs/common';
import { VpnServersService } from './vpn-servers.service';

@Module({
  providers: [VpnServersService],
  exports: [VpnServersService],
})
export class VpnServersModule {}

