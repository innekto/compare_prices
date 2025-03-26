import { PartialType } from '@nestjs/mapped-types';
import { CreateConverterDto } from './create-converter.dto';

export class UpdateConverterDto extends PartialType(CreateConverterDto) {}
