import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DocumentStatusEnum } from 'src/common/enum/document-status.enum';

export class DocumentStatusResponseDto {
  @ApiProperty()
  documentId!: string;

  @ApiProperty({ enum: DocumentStatusEnum })
  status!: DocumentStatusEnum;

  @ApiPropertyOptional({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty()
  chunkCount!: number;

  @ApiPropertyOptional({ type: Number, nullable: true })
  pageCount!: number | null;

  @ApiProperty()
  updatedAt!: Date;
}
