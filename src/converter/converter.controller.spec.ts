import { Test, TestingModule } from '@nestjs/testing';
import { ConverterController } from './converter.controller';
import { ConverterService } from './converter.service';

describe('ConverterController', () => {
  let controller: ConverterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConverterController],
      providers: [ConverterService],
    }).compile();

    controller = module.get<ConverterController>(ConverterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
