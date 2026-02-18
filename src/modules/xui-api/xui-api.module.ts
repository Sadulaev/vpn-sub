import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XuiServer, Subscription, Client } from '@database/entities';
import { XuiApiService } from './xui-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([XuiServer, Subscription, Client])],
  providers: [XuiApiService],
  exports: [XuiApiService],
})
export class XuiApiModule {}
