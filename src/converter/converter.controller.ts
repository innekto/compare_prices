import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { ConverterService } from './converter.service';
import { Response } from 'express';
import * as path from 'path';

@Controller('upload')
export class ConverterController {
  constructor(private readonly converterService: ConverterService) {}
  @Post()
  @ApiOperation({ summary: 'Upload an XML file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload XML file',
    required: true,
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
    @Res() res: Response,
  ) {
    if (!file) {
      throw new BadRequestException('file is required!');
    }
    await this.converterService.convertXmlFileToObjects(file);

    const outputDir = path.join(process.cwd(), 'reports');
    const finalFilePath = path.join(outputDir, 'finalReport.json');

    return res.download(finalFilePath, (err) => {
      if (err) {
        return res.status(500).send('Error downloading the file.');
      }
    });
  }
}
