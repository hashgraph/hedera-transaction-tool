import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';

@Module({
  imports: [
    WinstonModule.forRoot({
      level: 'info',
      format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(({ timestamp, level, message, stack }) => {
          return stack
            ? `${timestamp} [${level.toUpperCase()}]: ${message} - ${stack}`
            : `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'combined.log' })
      ]
    })
  ]
})
export class LoggerModule {}