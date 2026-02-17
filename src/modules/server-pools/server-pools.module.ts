import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServerPool, XuiServer } from '@database/entities';
import { XuiApiModule } from '@modules/xui-api';
import { ServerPoolsService } from './server-pools.service';
import { ServerPoolsController } from './server-pools.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServerPool, XuiServer]),
    XuiApiModule,
  ],
  controllers: [ServerPoolsController],
  providers: [ServerPoolsService],
  exports: [ServerPoolsService],
})
export class ServerPoolsModule {}
