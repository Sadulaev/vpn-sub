import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User, BotState } from '@database/entities';
import { VpnServersModule } from '@modules/vpn-servers';
import { GoogleSheetsModule } from '@modules/google-sheets';
import { AdminBotService } from './services/admin-bot.service';
import { BotStateService } from './services/bot-state.service';
import { BroadcastService } from './services/broadcast.service';
import { AdminBotUpdate } from './admin-bot.update';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BotState]),
    VpnServersModule,
    GoogleSheetsModule,
  ],
  providers: [AdminBotService, BotStateService, BroadcastService, AdminBotUpdate],
  exports: [BotStateService],
})
export class AdminBotModule {}

