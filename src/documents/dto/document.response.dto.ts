import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';

export class DocumentResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ description: 'Agente dono do documento' })
  agentId!: string;

  @ApiProperty({ description: 'Thread do documento', nullable: true })
  threadId!: string | null;

  @ApiProperty()
  filename!: string;

  @ApiProperty()
  originalName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty({ description: 'Tamanho em bytes' })
  size!: number;

  @ApiProperty({ enum: DocumentStatusEnum })
  status!: DocumentStatusEnum;

  @ApiPropertyOptional({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty()
  chunkCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  pageCount!: number | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class PaginatedDocumentsResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  items!: DocumentResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
