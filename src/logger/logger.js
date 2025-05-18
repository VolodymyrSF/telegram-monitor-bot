import winston from 'winston';
import 'winston-daily-rotate-file';

const transport = new winston.transports.DailyRotateFile({
  filename: './logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '14d',
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(info => `[${info.level.toUpperCase()} ${info.timestamp}] ${info.message}`)
  ),
  transports: [
    transport,
    new winston.transports.Console()
  ]
});

export const logInfo = (msg) => logger.info(msg);
export const logWarn = (msg) => logger.warn(msg);
export const logError = (msg) => logger.error(msg);
