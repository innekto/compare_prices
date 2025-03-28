import { Module } from '@nestjs/common';
import { ConverterService } from './converter.service';
import { ConverterController } from './converter.controller';
import { HttpModule } from '@nestjs/axios';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';

@Module({
  imports: [HttpModule],
  controllers: [ConverterController],
  providers: [ConverterService, CloudinaryService],
})
export class ConverterModule {}
