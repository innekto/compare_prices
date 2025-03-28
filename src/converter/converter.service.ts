import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { IReportsDTO } from 'src/common/interface';
import * as unzipper from 'unzipper';
import * as JSONStream from 'JSONStream';

import * as fs from 'fs';
import * as path from 'path';
import { Readable, Transform } from 'stream';
import { xmlToArray } from 'src/common/xml.parse';

@Injectable()
export class ConverterService {
  constructor(private readonly httpService: HttpService) {}

  private readonly logger = new Logger(ConverterService.name);
  private readonly apiKey = process.env.API_KEY;
  private readonly baseUrl = process.env.BASE_URL;
  private readonly reportsUrl = process.env.REPORT_STATUS_URL;
  private readonly priceDifference = process.env.PRICE_DIFFERENCE;
  private readonly chunkSize = process.env.CHUNK_SIZE;

  async convertXmlFileToObjects(file: Express.Multer.File) {
    const productGroups = await xmlToArray(
      file,
      this.priceDifference,
      +this.chunkSize,
    );

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

      this.logger.log('Waiting for 2 seconds before processing next group...');
      await delay(2000);
    }
  }

  async postReport(dto: IReportsDTO) {
    const delay = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
      try {
        const response = await firstValueFrom(
          this.httpService.post(this.baseUrl, dto, {
            headers: {
              'X-API-KEY': this.apiKey,
            },
          }),
        );

        return response.data.id; // Успішно – виходимо з циклу
      } catch (error) {
        const errorData = error.response?.data || {};
        const errorMessage = error.message || 'Unknown error';

        if (error.response?.status === 429) {
          this.logger.warn(
            `429 Чекаємо 10 сек... | Деталі: ${JSON.stringify(errorData, null, 2)}`,
          );
          await delay(10000); // Фіксована затримка 10 секунд
          continue; // Пробуємо ще раз
        }

        this.logger.error(
          `Помилка в postReport: ${errorMessage} | Деталі: ${JSON.stringify(errorData, null, 2)}`,
        );
        throw new Error(`Error while posting report: ${errorMessage}`);
      }
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
        const response = await firstValueFrom(
          this.httpService.get(`${this.baseUrl}/${reportId}`, {
            headers: {
              'X-API-KEY': this.apiKey,
            },
            responseType: 'arraybuffer',
          }),
        );

        const zipStream = Readable.from(response.data);

        zipStream
          .pipe(unzipper.Parse())
          .on('entry', (entry) => {
            const fileName = entry.path;

            if (fileName.endsWith('.json')) {
              entry
                .pipe(JSONStream.parse('*'))
                .pipe(this.appendToFinalJsonStream());
            } else {
              entry.autodrain();
            }
          })
          .on('close', () => {
            this.logger.log('Finished processing all files');
          })
          .on('error', (err) => {
            this.logger.error(`Error during report processing: ${err.message}`);
            throw err;
          });

        break;
      } catch (error) {
        const statusCode = error.response?.status;
        if (retryableErrors.includes(statusCode)) {
          this.logger.warn(
            `Error downloading report (status: ${statusCode}). Retrying in 10s...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } else {
          this.logger.error(
            `Error downloading report: ${error.message}. Aborting.`,
          );
          throw error;
        }
      }
    }
  }

  private appendToFinalJsonStream() {
    const outputDir = path.join(process.cwd(), 'reports');
    const logger = this.logger;

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const finalFilePath = path.join(outputDir, 'finalReport.json');
    const writeStream = fs.createWriteStream(finalFilePath, { flags: 'w' });

    let firstWrite = true;

    const transformStream = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        // Якщо це перший елемент, то додаємо відкриваючі дужки для масиву "matchedProducts"
        if (firstWrite) {
          writeStream.write('{"matchedProducts":');
          firstWrite = false;
        } else {
          writeStream.write(',');
        }

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
        writeStream.write('}');
        writeStream.end();
        callback();
      },
    });

    return transformStream;
  }
}
