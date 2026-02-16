import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerPool, XuiServer } from '@database/entities';
import { XuiApiModule } from '@modules/xui-api';
import { ServerPoolsService } from './server-pools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServerPool, XuiServer]),
    XuiApiModule,
  ],
  providers: [ServerPoolsService],
  exports: [ServerPoolsService],
})
export class ServerPoolsModule {}
