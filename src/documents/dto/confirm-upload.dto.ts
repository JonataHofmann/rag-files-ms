import { IsEnum, IsNotEmpty, IsString, ValidateIf } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';
import { FileTypeEnum } from 'src/common/enum/file-type.enum';

export class ConfirmUploadDto {
  @ApiProperty({ description: 'Nome do blob retornado no init' })
  @IsString()
  blobName!: string;

  @ApiProperty({ description: 'Nome original do arquivo' })
  @IsString()
  originalName!: string;

  @ApiProperty({ description: 'MIME type do arquivo' })
  @IsString()
  mimeType!: string;

  @ApiProperty({ description: 'Tamanho do arquivo em bytes' })
  @IsString()
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
