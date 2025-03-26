import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ConverterService } from './converter.service';
import { CreateConverterDto } from './dto/create-converter.dto';
import { UpdateConverterDto } from './dto/update-converter.dto';

@Controller('converter')
export class ConverterController {
  constructor(private readonly converterService: ConverterService) {}

  @Post()
  create(@Body() createConverterDto: CreateConverterDto) {
    return this.converterService.create(createConverterDto);
  }

  @Get()
  findAll() {
    return this.converterService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.converterService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateConverterDto: UpdateConverterDto) {
    return this.converterService.update(+id, updateConverterDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.converterService.remove(+id);
  }
}
