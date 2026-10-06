import {
  IsEnum,
  IsInt,
  IsMimeType,
  IsNotEmpty,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';

export class InitUploadDto {
  @ApiProperty({ description: 'Nome original do arquivo' })
  @IsString()
  originalName!: string;

  @ApiProperty({ description: 'MIME type do arquivo' })
  @IsMimeType()
  mimeType!: string;

  @ApiProperty({ description: 'Tamanho do arquivo em bytes' })
  @IsInt()
  @Min(1)
  size!: number;

  @ApiProperty({ description: 'Agente dono do documento' })
  @IsNotEmpty()
  agentId!: string;

  @ApiProperty({ description: 'Thread vinculada ao arquivo' })
  @IsString()
  @ValidateIf((o) => o.type === FileTypeEnum.USER)
  @IsNotEmpty({ message: 'threadId é obrigatório quando type é "user"' })
  threadId?: string;

  @ApiProperty({ description: 'Mensagem vinculada ao arquivo' })
  @IsString()
  @ValidateIf((o) => o.type === FileTypeEnum.USER)
  @IsNotEmpty({ message: 'messageId é obrigatório quando type é "user"' })
  messageId?: string;

  @ApiProperty({ description: 'Usuário dono do arquivo' })
  @IsString()
  @IsNotEmpty({ message: 'userId é obrigatório' })
  userId!: string;

  @ApiProperty({
    description: 'Tipo do arquivo',
    enum: FileTypeEnum,
  })
  @IsEnum(FileTypeEnum, {
    message: 'type deve ser "user" ou "system"',
  })
  type!: FileTypeEnum;
}

export class InitUploadResponseDto {
  @ApiProperty({ description: 'URL autoassinada para upload' })
  signedUrl!: string;

  @ApiProperty({ description: 'Nome do blob no storage' })
  blobName!: string;

  @ApiProperty({ description: 'Data de expiração da URL' })
  expiresAt!: Date;
}
