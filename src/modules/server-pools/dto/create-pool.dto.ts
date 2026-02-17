import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePoolDto {
  @ApiProperty({ example: 'Europe', description: 'Название пула серверов' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ example: 'Серверы в Европе', description: 'Описание пула' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Активен ли пул', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
