import { Injectable } from '@nestjs/common';
import * as xml2js from 'xml2js';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { IProduct, IReportsDTO } from 'src/common/interface';

@Injectable()
export class ConverterService {
  constructor(private readonly httpService: HttpService) {}

  async convertXmlFileToObjects(apiKey: string, file: Express.Multer.File) {
    const parser = new xml2js.Parser();
    const xmlContent = file.buffer.toString('utf-8');
    const result: any = await parser.parseStringPromise(xmlContent);
    const items = result.rss.channel[0].item;

    const products: IProduct[] = items.map((item: any) => {
      const priceString = item['g:price'][0];
      const approximatePrice = parseFloat(priceString.replace(/[^\d.-]/g, ''));
      return {
        id: item['g:id'][0],
        title: item['g:title'][0],
        approximatePrice: approximatePrice,
        priceDifference: 300,
      };
    });

    const dto: IReportsDTO = {
      products: products.slice(0, 4),
      sources: ['google-search', 'google-shopping'],
      matchByAi: true,
    };
    const reportId = await this.postReport(apiKey, dto);
  }

  async postReport(apiKey: string, dto: IReportsDTO) {
    const baseUrl = process.env.BASE_URL;

    try {
      const response = await firstValueFrom(
        this.httpService.post(baseUrl, dto, {
          headers: {
            'X-API-KEY': apiKey,
          },
        }),
      );

      return response.data.id;
    } catch (error) {
      throw new Error(`Error while posting report: ${error.message}`);
    }
  }
}
