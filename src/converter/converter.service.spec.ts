import { Test, TestingModule } from '@nestjs/testing';
import { ConverterService } from './converter.service';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';

describe('ConverterService', () => {
  let service: ConverterService;
  let httpService: HttpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConverterService,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ConverterService>(ConverterService);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should return report ID on success', async () => {
    const mockResponse: AxiosResponse<{ id: string }> = {
      data: { id: '12345' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig<any>,
    };

    jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

    const result = await service.postReport({
      products: [],
      sources: [],
      matchByAi: false,
    });

    expect(result).toBe('12345');
  });

  it('should retry on 429 error', async () => {
    jest.setTimeout(10000); // збільшуємо час очікування для цього тесту

    console.log('Starting retry test');
    const errorResponse = {
      response: { status: 429, data: { message: 'Too many requests' } },
    };

    const mockResponse: AxiosResponse<{ id: string }> = {
      data: { id: '67890' },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { headers: {} } as InternalAxiosRequestConfig<any>,
    };

    // Мокаємо першу спробу на 429 помилку
    jest
      .spyOn(httpService, 'post')
      .mockReturnValueOnce(throwError(() => errorResponse));

    // Затримка перед другою спробою
    console.log('Waiting 1 second before retry');
    await new Promise((resolve) => setTimeout(resolve, 1000)); // чекаємо 1 секунду

    // Мокаємо другу спробу з успішною відповіддю
    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(mockResponse));

    console.log('Attempting second request');
    // Викликаємо сервіс і чекаємо результат
    const result = await service.postReport({
      products: [],
      sources: [],
      matchByAi: false,
    });

    // Перевіряємо, що результат буде ідентифікатором
    console.log('Received result:', result);
    expect(result).toBe('67890');
  }, 15000); // Тест триватиме до 15 секунд

  it('should throw an error on unexpected response', async () => {
    jest
      .spyOn(httpService, 'post')
      .mockReturnValue(throwError(() => new Error('Server error')));

    await expect(
      service.postReport({ products: [], sources: [], matchByAi: false }),
    ).rejects.toThrow('Error while posting report: Server error');
  });
});
