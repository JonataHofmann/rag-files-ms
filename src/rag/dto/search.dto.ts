import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SearchRequestDto {
  @ApiProperty({ description: 'Texto da busca semântica' })
  @IsString()
  @IsNotEmpty()
  query!: string;

  @ApiProperty({ description: 'Agente dono dos documentos' })
  @IsNotEmpty()
  agentId!: string;

  @ApiPropertyOptional({ description: 'Filtrar por usuário' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por documento' })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({ description: 'Filtrar pelos arquivos de uma thread' })
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({
    description: 'Máximo de resultados (default 8)',
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Score mínimo de similaridade (0 a 1)',
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @Min(0)
  @Max(1)
  minScore?: number;
}

export class SearchResultItemDto {
  @ApiProperty()
  chunkId!: string;

  @ApiProperty({ description: 'Similaridade cosine (0 a 1)' })
  score!: number;

  @ApiProperty()
  documentId!: string;

  @ApiProperty()
  filename!: string;

  @ApiPropertyOptional({ type: Number, nullable: true })
  page!: number | null;

  @ApiProperty()
  chunkIndex!: number;

  @ApiProperty()
  text!: string;

  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;
}

export class SearchResponseDto {
  @ApiProperty({ type: [SearchResultItemDto] })
  results!: SearchResultItemDto[];

  @ApiProperty()
  total!: number;
}
