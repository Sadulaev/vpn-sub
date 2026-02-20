import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SubscriptionSource } from '@database/entities';

export class CreateSubscriptionDto {
  /** UUID клиента */
  @ApiPropertyOptional({ 
    example: 'a5f2c3d4-1234-5678-90ab-cdef12345678', 
    description: 'UUID клиента. Если не указан - генерируется автоматически' 
  })
  @IsString()
  @IsOptional()
  clientId?: string;

  /** Telegram ID клиента */
  @ApiPropertyOptional({ 
    example: '123456789', 
    description: 'Telegram ID клиента (опционально)' 
  })
  @IsString()
  @IsOptional()
  telegramId?: string;

  /** Период подписки в днях */
  @ApiProperty({ example: 30, description: 'Период подписки в днях (1-365)', minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  days!: number;

  /** Источник создания подписки */
  @ApiPropertyOptional({ 
    enum: SubscriptionSource, 
    example: SubscriptionSource.ADMIN, 
    description: 'Источник создания (админка или бот)',
    default: SubscriptionSource.ADMIN 
  })
  @IsEnum(SubscriptionSource)
  @IsOptional()
  source?: SubscriptionSource;

  /** Примечание к подписке */
  @ApiPropertyOptional({ 
    example: 'Тестовый пользователь', 
    description: 'Примечание к подписке (опционально)' 
  })
  @IsString()
  @IsOptional()
  note?: string;

  /** Лимит одновременных устройств */
  @ApiPropertyOptional({ 
    example: 3, 
    description: 'Максимальное количество одновременно подключенных устройств (1-10)',
    default: 3,
    minimum: 1,
    maximum: 10
  })
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  deviceLimit?: number;
}
