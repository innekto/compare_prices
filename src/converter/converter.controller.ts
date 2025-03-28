import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ConverterService } from './converter.service';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Controller('upload')
export class ConverterController {
  constructor(
    private readonly converterService: ConverterService,
    readonly cloudinaryService: CloudinaryService,
  ) {}
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
  @ApiResponse({
    status: 201,
    description: 'File successfully uploaded',
    example: {
      url: 'https://res.cloudinary.....json',
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

    const fileBuffer = await fs.promises.readFile(finalFilePath);

    try {
      const uploadResult = await this.cloudinaryService.uploadFile(
        fileBuffer,
        'finalReport',
      );
      const secureUrl = uploadResult.secure_url;
      await fs.promises.unlink(finalFilePath);
      return res.json({ url: secureUrl });
    } catch (error) {
      if (error) throw error;
    }
  }
}
