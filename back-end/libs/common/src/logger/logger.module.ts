import { Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { transports, format } from 'winston';

@Module({
  imports: [
    WinstonModule.forRootAsync({
      useFactory() {
        return {
          level: process.env.LOG_LEVEL || 'info',
          format: format.combine(
            format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            format.printf(({ timestamp, level, message, stack }) => {
              return stack
                ? `${timestamp} [${level.toUpperCase()}]: ${message} - ${stack}`
                : `${timestamp} [${level.toUpperCase()}]: ${message}`;
            }),
          ),
          transports: [new transports.Console({ stderrLevels: ['error'] })],
        };
      },
    }),
  ],
})
export class LoggerModule {}
