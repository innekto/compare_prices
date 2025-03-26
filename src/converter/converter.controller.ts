import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Headers,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiOperation, ApiHeader } from '@nestjs/swagger';
import { ConverterService } from './converter.service';

@Controller('upload')
export class ConverterController {
  constructor(private readonly converterService: ConverterService) {}
  @Post()
  @ApiOperation({ summary: 'Upload an XML file' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({
    name: 'API-KEY', // передаємо ім'я заголовка
    description: 'API key for authentication', // описуємо заголовок
    required: true, // вказуємо, що цей заголовок є обовʼязковим
  })
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
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Headers() headers: Record<string, string>,
  ) {
    const apiKey = headers['api-key'];

    return await this.converterService.convertXmlFileToObjects(apiKey, file);
  }
}
