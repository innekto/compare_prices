import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ConverterService } from './converter.service';

@Controller('upload')
export class ConverterController {
  constructor(private readonly converterService: ConverterService) {}
  @Post()
  @ApiOperation({ summary: 'Upload an XML file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload XML file',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return await this.converterService.convertXmlFileToObjects(file);
  }
}
