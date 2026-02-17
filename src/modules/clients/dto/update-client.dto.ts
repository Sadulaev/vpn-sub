import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClientDto {
  @ApiPropertyOptional({ example: 'john_doe', description: 'Username в Telegram' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ example: 'John', description: 'Имя пользователя в Telegram' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: true, description: 'Активен ли клиент' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
