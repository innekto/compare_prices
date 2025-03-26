import { Injectable } from '@nestjs/common';
import { CreateConverterDto } from './dto/create-converter.dto';
import { UpdateConverterDto } from './dto/update-converter.dto';

@Injectable()
export class ConverterService {
  create(createConverterDto: CreateConverterDto) {
    return 'This action adds a new converter';
  }

  findAll() {
    return `This action returns all converter`;
  }

  findOne(id: number) {
    return `This action returns a #${id} converter`;
  }

  update(id: number, updateConverterDto: UpdateConverterDto) {
    return `This action updates a #${id} converter`;
  }

  remove(id: number) {
    return `This action removes a #${id} converter`;
  }
}
