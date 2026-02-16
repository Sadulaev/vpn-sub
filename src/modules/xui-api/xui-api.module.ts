import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { XuiServer } from '@database/entities';
import { XuiApiService } from './xui-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([XuiServer])],
  providers: [XuiApiService],
  exports: [XuiApiService],
})
export class XuiApiModule {}
