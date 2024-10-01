import { Module, ConsoleLogger } from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

const winstonLogger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
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