import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePoolDto {
  @ApiPropertyOptional({ example: 'Europe', description: 'Название пула серверов' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ example: 'Серверы в Европе', description: 'Описание пула' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: true, description: 'Активен ли пул' })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
