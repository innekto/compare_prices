import { Injectable, Logger } from '@nestjs/common';
import * as xml2js from 'xml2js';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { IProduct, IReportsDTO } from 'src/common/interface';
import * as unzipper from 'unzipper'; // Для розпакування
import * as JSONStream from 'JSONStream'; // Для потокового запису в JSON

import * as fs from 'fs';
import * as path from 'path';
import { Readable, Transform } from 'stream';

@Injectable()
export class ConverterService {
  constructor(private readonly httpService: HttpService) {}

  private readonly logger = new Logger(ConverterService.name);
  private readonly apiKey = process.env.API_KEY;
  private readonly baseUrl = process.env.BASE_URL;
  private readonly reportsUrl = process.env.REPORT_STATUS_URL;
  private readonly priceDiffernce = process.env.PRICE_DIFFERENCE;
  private readonly chunkSize = process.env.CHUNK_SIZE;

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
        priceDifference: this.priceDiffernce,
      };
    });

    const chunkSize: number = +this.chunkSize;
    const testProducts = products.slice(0, 2);

    const productGroups = testProducts.reduce((groups, product, index) => {
      const groupIndex = Math.floor(index / chunkSize);

      if (!groups[groupIndex]) {
        groups[groupIndex] = [];
      }
      groups[groupIndex].push(product);

      return groups;
    }, []);
    // console.log('productGroups :>> ', productGroups);
    // const lenght = productGroups.length;

    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    for (const group of productGroups) {
      const dto: IReportsDTO = {
        products: group,
        sources: ['google-search', 'google-shopping'],
        matchByAi: false,
      };

      try {
        const reportId = await this.postReport(dto);
        if (reportId) {
          this.logger.log(`Report created successfully. ID: ${reportId}`);
          await this.pollReportStatus(reportId);
          await this.downloadAndProcessReport(reportId);
        }
      } catch (error) {
        this.logger.error(`Error in convertXmlFileToObjects: ${error.message}`);
      }

      // Затримка 2 секунди між запитами для кожної групи
      this.logger.log('Waiting for 2 seconds before processing next group...');
      await delay(2000); // Затримка 2 секунди
    }
  }

  async postReport(dto: IReportsDTO) {
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
      this.logger.log(
        `error data: ${JSON.stringify(error.response.data, null, 2)}`,
      );

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
        console.log('reportStatus :>> ', reportStatus);

        if (reportStatus === 'Fulfilled') {
          this.logger.log(`Report is ready: ${JSON.stringify(response.data)}`);
          break;
        }

        this.logger.log(`Report status: ${reportStatus}, retrying in 10s...`);
      } catch (error) {
        this.logger.error(
          `Error polling report: ${error.message}, retrying in 10s...`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }

  async downloadAndProcessReport(reportId: string) {
    this.logger.log(`Downloading and processing report for ID: ${reportId}`);

    const retryableErrors = [503, 429, 500];

    while (true) {
      try {
        // Завантаження ZIP файлу без збереження на диск
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/${reportId}`, {
            headers: {
              'X-API-KEY': this.apiKey,
            },
            responseType: 'arraybuffer',
          }),
        );

        // Створення потоку для отриманих даних
        const zipStream = Readable.from(response.data);

        // Розпакування ZIP через потоки
        zipStream
          .pipe(unzipper.Parse()) // Розпаковуємо ZIP на льоту
          .on('entry', (entry) => {
            const fileName = entry.path;

            if (fileName.endsWith('.json')) {
              entry
                .pipe(JSONStream.parse('*')) // Розбираємо JSON в потік
                .pipe(this.appendToFinalJsonStream());
            } else {
              entry.autodrain(); // Пропускаємо інші файли
            }
          })
          .on('close', () => {
            this.logger.log('Finished processing all files');
          })
          .on('error', (err) => {
            this.logger.error(`Error during report processing: ${err.message}`);
            throw err;
          });

        break; // Вихід з циклу після успішного завантаження та обробки
      } catch (error) {
        const statusCode = error.response?.status;
        if (retryableErrors.includes(statusCode)) {
          this.logger.warn(
            `Error downloading report (status: ${statusCode}). Retrying in 10s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 10000)); // Затримка перед повтором
        } else {
          this.logger.error(
            `Error downloading report: ${error.message}. Aborting.`,
          );
          throw error; // Якщо помилка не відновлювана, зупиняємо цикл
        }
      }
    }
  }

  private appendToFinalJsonStream() {
    const outputDir = path.join(process.cwd(), 'reports');
    const logger = this.logger;

    // Перевіряємо чи існує директорія, якщо ні - створюємо
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true }); // Створюємо папку, якщо її немає
    }

    const finalFilePath = path.join(outputDir, 'finalReport.json');
    const writeStream = fs.createWriteStream(finalFilePath, { flags: 'w' }); // Використовуємо 'w' для перезапису файлу

    let firstWrite = true;

    // Створюємо потік, який записує chunk
    const transformStream = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // Якщо це перший елемент, то додаємо відкриваючі дужки для масиву "matchedProducts"
        if (firstWrite) {
          writeStream.write('{"matchedProducts":[');
          firstWrite = false;
        } else {
          writeStream.write(',');
        }

        // Перевірка та запис JSON
        if (typeof chunk === 'object') {
          writeStream.write(JSON.stringify(chunk));
        } else if (typeof chunk === 'string') {
          writeStream.write(chunk);
        } else {
          logger.error(
            'Expected chunk to be an object or string, but got:',
            typeof chunk,
          );
        }

        callback();
      },
      flush(callback) {
        // Завершуємо масив і об'єкт, додаємо закриваючі дужки
        writeStream.write('], "matchingProductErrors": null}');
        writeStream.end();
        callback();
      },
    });

    // Повертаємо потік для запису
    return transformStream;
  }
}
