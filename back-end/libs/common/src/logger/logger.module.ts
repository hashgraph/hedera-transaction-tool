import { Module, ConsoleLogger } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

// Custom format to redact sensitive information
const redactSensitiveInfo = format((info) => {
  const sensitiveFields = ['password']; // Add fields to redact
  sensitiveFields.forEach((field) => {
    if (info[field]) {
      info[field] = 'REDACTED';
    }
  });
  return info;
});

const customFormat = format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level.toUpperCase()}]: ${stack || message}`;
});

const winstonLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    redactSensitiveInfo(),
    customFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

class WinstonLogger extends ConsoleLogger {
  log(message: string) {
    winstonLogger.info(message);
  }
  error(message: string, trace: string) {
    winstonLogger.error(message, { trace });
  }
  warn(message: string) {
    winstonLogger.warn(message);
  }
  debug(message: string) {
    winstonLogger.debug(message);
  }
  verbose(message: string) {
    winstonLogger.verbose(message);
  }
}

@Module({
  providers: [
    {
      provide: 'winston',
      useValue: winstonLogger,
    },
    {
      provide: ConsoleLogger,
      useClass: WinstonLogger,
    },
  ],
  exports: [ConsoleLogger],
})
export class LoggerModule {}