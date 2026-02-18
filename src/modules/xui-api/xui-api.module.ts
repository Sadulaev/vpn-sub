import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XuiServer, Subscription } from '@database/entities';
import { XuiApiService } from './xui-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([XuiServer, Subscription])],
  providers: [XuiApiService],
  exports: [XuiApiService],
})
export class XuiApiModule {}
