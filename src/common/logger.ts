import { LoggerOptions, transports, createLogger, format } from 'winston';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const logDirectory = join(process.cwd(), 'logs');

if (!existsSync(logDirectory)) {
  mkdirSync(logDirectory);
}

const loggerOptions: LoggerOptions = {
  level: 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    }),
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: join(logDirectory, 'app.log') }),
  ],
};

export const logger = createLogger(loggerOptions);
