import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { Express } from 'express';

export class UploadXmlDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'XML file to upload',
  })
  @IsNotEmpty()
  file: Express.Multer.File;
}
