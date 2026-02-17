import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateClientDto {
  @ApiProperty({ example: '123456789', description: 'Telegram ID клиента' })
  @IsString()
  telegramId!: string;

  @ApiPropertyOptional({ example: 'john_doe', description: 'Username в Telegram' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'John', description: 'Имя пользователя в Telegram' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: true, description: 'Активен ли клиент', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
