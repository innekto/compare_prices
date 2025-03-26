import { Injectable, Logger } from '@nestjs/common';
import * as xml2js from 'xml2js';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { IProduct, IReportsDTO } from 'src/common/interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ConverterService {
  constructor(private readonly httpService: HttpService) {}

  private readonly logger = new Logger(ConverterService.name);
  private readonly apiKey = process.env.API_KEY;
  private readonly baseUrl = process.env.BASE_URL;
  private readonly reportsUrl = new URL('/info', this.baseUrl).toString();

  async convertXmlFileToObjects(file: Express.Multer.File) {
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
    console.log('dto :>> ', dto);
    try {
      const reportId = await this.postReport(dto);
      if (reportId) {
        this.logger.log(`Report created successfully. ID: ${reportId}`);
        await this.pollReportStatus(reportId);
        await this.downloadReport(reportId);
      }
    } catch (error) {
      this.logger.error(`Error in convertXmlFileToObjects: ${error.message}`);
    }
  }

  async postReport(dto: IReportsDTO) {
    console.log('this.apiKey :>> ', this.apiKey);
    try {
      const response = await firstValueFrom(
        this.httpService.post(this.baseUrl, dto, {
          headers: {
            'X-API-KEY': this.apiKey,
          },
        }),
      );

      return response.data.id;
    } catch (error) {
      this.logger.log(`error data: ${error.response.data}}`);
      throw new Error(`Error while posting report: ${error.message}`);
    }
  }

  async pollReportStatus(reportId: string) {
    this.logger.log(`Polling report status for ID: ${reportId}`);

    while (true) {
      try {
        const response = await firstValueFrom(
          this.httpService.get(`${this.reportsUrl}/${reportId}`, {
            headers: {
              'X-API-KEY': this.apiKey,
            },
          }),
        );

        const { reportStatus } = response.data;

        if (reportStatus === 'Archived') {
          this.logger.log(
            `Report is archived: ${JSON.stringify(response.data)}`,
          );
          break;
        } else {
          this.logger.log(`Report status: ${reportStatus}, retrying in 10s...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
        }
      } catch (error) {
        this.logger.error(
          `Error polling report: ${error.message}, retrying in 10s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }

  async downloadReport(reportId: string) {
    try {
      this.logger.log(`Downloading report for ID: ${reportId}`);

      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/${reportId}`, {
          headers: {
            'X-API-KEY': this.apiKey,
          },
          responseType: 'arraybuffer', // Очікуємо бінарні дані
        }),
      );

      const filePath = path.join(process.cwd(), `${reportId}.zip`);
      fs.writeFileSync(filePath, response.data);

      this.logger.log(`Report saved successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Error downloading report: ${error.message}`);
    }
  }
}
