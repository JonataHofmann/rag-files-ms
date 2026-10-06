import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';
import { Type } from 'class-transformer';

export class ListDocumentsQueryDto {
  @ApiProperty({ description: 'Usuário dono dos documentos' })
  @IsString()
  @IsNotEmpty({ message: 'userId é obrigatório' })
  userId!: string;

  @ApiPropertyOptional({ description: 'Busca por nome do arquivo' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtro por agente' })
  @IsOptional()
  agentId?: string;

  @ApiPropertyOptional({ description: 'Filtro por conversa (thread)' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({
    enum: DocumentStatusEnum,
    description: 'Filtro por status',
  })
  @IsOptional()
  @IsEnum(DocumentStatusEnum)
  status?: DocumentStatusEnum;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
