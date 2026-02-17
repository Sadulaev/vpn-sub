import { IsString, IsInt, IsOptional, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { XuiServerStatus } from '@database/entities';

export class UpdateServerDto {
  @ApiPropertyOptional({ example: 'Germany-1', description: 'Читаемое имя сервера' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'https://1.2.3.4:2053', description: 'Базовый URL панели 3x-ui' })
  @IsString()
  @IsOptional()
  apiUrl?: string;

  @ApiPropertyOptional({ example: 'dashboard', description: 'Web base path панели' })
  @IsString()
  @IsOptional()
  webBasePath?: string;

  @ApiPropertyOptional({ example: 'admin', description: 'Логин от панели 3x-ui' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'password123', description: 'Пароль от панели 3x-ui' })
  @IsString()
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 1, description: 'ID инбаунда' })
  @IsInt()
  @IsOptional()
  inboundId?: number;

  @ApiPropertyOptional({ example: 'vpn.example.com', description: 'Публичный хост для VLESS-ссылки' })
  @IsString()
  @IsOptional()
  publicHost?: string;

  @ApiPropertyOptional({ example: 443, description: 'Публичный порт для VLESS-ссылки' })
  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  publicPort?: number;

  @ApiPropertyOptional({ example: 'reality', description: 'Тип безопасности' })
  @IsString()
  @IsOptional()
  security?: string;

  @ApiPropertyOptional({ example: 'SX7Jyungg...', description: 'Public key (для reality)' })
  @IsString()
  @IsOptional()
  pbk?: string;

  @ApiPropertyOptional({ example: 'chrome', description: 'Fingerprint' })
  @IsString()
  @IsOptional()
  fp?: string;

  @ApiPropertyOptional({ example: 'www.google.com', description: 'SNI' })
  @IsString()
  @IsOptional()
  sni?: string;

  @ApiPropertyOptional({ example: '6ba85179e30d4fc2', description: 'Short ID' })
  @IsString()
  @IsOptional()
  sid?: string;

  @ApiPropertyOptional({ example: '/', description: 'Spider X' })
  @IsString()
  @IsOptional()
  spx?: string;

  @ApiPropertyOptional({ example: 'xtls-rprx-vision', description: 'Flow' })
  @IsString()
  @IsOptional()
  flow?: string;

  @ApiPropertyOptional({ enum: XuiServerStatus, example: XuiServerStatus.ACTIVE, description: 'Статус сервера' })
  @IsEnum(XuiServerStatus)
  @IsOptional()
  status?: XuiServerStatus;

  @ApiPropertyOptional({ example: 100, description: 'Лимит пользователей' })
  @IsInt()
  @IsOptional()
  usersLimit?: number;

  @ApiPropertyOptional({ example: 1, description: 'ID пула серверов' })
  @IsInt()
  @IsOptional()
  serverPoolId?: number;
}
