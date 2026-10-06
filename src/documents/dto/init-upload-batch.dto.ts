import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { InitUploadDto, InitUploadResponseDto } from './init-upload.dto';

export class InitUploadBatchDto {
  @ApiProperty({
    description: 'Arquivos para iniciar upload',
    type: [InitUploadDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => InitUploadDto)
  files!: InitUploadDto[];
}

export class InitUploadBatchItemResponseDto extends InitUploadResponseDto {
  @ApiProperty({ description: 'Nome original do arquivo' })
  originalName!: string;
}

export class InitUploadBatchResponseDto {
  @ApiProperty({ type: [InitUploadBatchItemResponseDto] })
  items!: InitUploadBatchItemResponseDto[];
}
