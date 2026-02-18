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

  /** Период подписки в месяцах */
  @ApiProperty({ example: 1, description: 'Период подписки в месяцах (1-24)', minimum: 1, maximum: 24 })
  @IsInt()
  @Min(1)
  @Max(24)
  months!: number;

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
}
