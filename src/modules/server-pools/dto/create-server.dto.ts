import { IsString, IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { XuiServerStatus } from '@database/entities';

export class CreateServerDto {
  @ApiProperty({ example: 'Germany-1', description: 'Читаемое имя сервера' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'https://1.2.3.4:2053', description: 'Базовый URL панели 3x-ui' })
  @IsString()
  apiUrl!: string;

  @ApiPropertyOptional({ example: 'dashboard', description: 'Web base path панели (например "dashboard" → /dashboard/panel/api/...)' })
  @IsString()
  @IsOptional()
  webBasePath?: string;

  @ApiProperty({ example: 'admin', description: 'Логин от панели 3x-ui' })
  @IsString()
  username!: string;

  @ApiProperty({ example: 'password123', description: 'Пароль от панели 3x-ui' })
  @IsString()
  password!: string;

  @ApiPropertyOptional({ example: 1, description: 'ID инбаунда, в который добавляются клиенты' })
  @IsInt()
  @IsOptional()
  inboundId?: number;

  @ApiProperty({ example: 'vpn.example.com', description: 'Публичный хост для VLESS-ссылки' })
  @IsString()
  publicHost!: string;

  @ApiPropertyOptional({ example: 443, description: 'Публичный порт для VLESS-ссылки', default: 443 })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  publicPort?: number;

  @ApiPropertyOptional({ example: 'reality', description: 'Тип безопасности (reality, tls и т.д.)', default: 'reality' })
  @IsString()
  @IsOptional()
  security?: string;

  @ApiPropertyOptional({ example: 'SX7Jyungg...', description: 'Public key (для reality)' })
  @IsString()
  @IsOptional()
  pbk?: string;

  @ApiPropertyOptional({ example: 'chrome', description: 'Fingerprint', default: 'chrome' })
  @IsString()
  @IsOptional()
  fp?: string;

  @ApiPropertyOptional({ example: 'www.google.com', description: 'SNI (Server Name Indication)' })
  @IsString()
  @IsOptional()
  sni?: string;

  @ApiPropertyOptional({ example: '6ba85179e30d4fc2', description: 'Short ID' })
  @IsString()
  @IsOptional()
  sid?: string;

  @ApiPropertyOptional({ example: '/', description: 'Spider X', default: '/' })
  @IsString()
  @IsOptional()
  spx?: string;

  @ApiPropertyOptional({ example: 'xtls-rprx-vision', description: 'Flow (например xtls-rprx-vision)' })
  @IsString()
  @IsOptional()
  flow?: string;

  @ApiPropertyOptional({ enum: XuiServerStatus, example: XuiServerStatus.ACTIVE, description: 'Статус сервера', default: XuiServerStatus.ACTIVE })
  @IsEnum(XuiServerStatus)
  @IsOptional()
  status?: XuiServerStatus;

  @ApiPropertyOptional({ example: 100, description: 'Лимит пользователей (для информации)', default: 100 })
  @IsInt()
  @IsOptional()
  usersLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID пула серверов' })
  @IsInt()
  @IsOptional()
  serverPoolId?: number;
}
