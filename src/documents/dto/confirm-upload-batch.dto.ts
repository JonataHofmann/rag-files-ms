import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { ConfirmUploadDto } from './confirm-upload.dto';
import { DocumentResponseDto } from './document.response.dto';

export class ConfirmUploadBatchDto {
  @ApiProperty({
    description: 'Uploads para confirmar',
    type: [ConfirmUploadDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ConfirmUploadDto)
  files!: ConfirmUploadDto[];
}

export class ConfirmUploadBatchResponseDto {
  @ApiProperty({ type: [DocumentResponseDto] })
  items!: DocumentResponseDto[];
}
