import { Logger } from '@nestjs/common';
import { JsMsg } from 'nats';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';

export class MessageValidator {
  static async parseAndValidate<T extends object>(
    msg: JsMsg,
    dtoClass: ClassConstructor<T>,
    logger: Logger
  ): Promise<T | T[] | null> {
    try {
      const dataStr = new TextDecoder().decode(msg.data);

      if (!dataStr || dataStr.trim() === '') {
        logger.warn(`Empty message on ${msg.subject}`);
        return null;
      }

      const rawData = JSON.parse(dataStr);

      if (Array.isArray(rawData)) {
        return await this.validateArray(rawData, dtoClass, msg.subject, logger);
      } else {
        return await this.validateSingle(rawData, dtoClass, msg.subject, logger);
      }
    } catch (error) {
      logger.error(`Parse error on ${msg.subject}:`, error.message);
      logger.error(`Raw message data (first 200 chars): "${msg.data.toString().substring(0, 200)}"`);
      return null;
    }
  }

  private static async validateArray<T extends object>(
    rawData: any[],
    dtoClass: ClassConstructor<T>,
    subject: string,
    logger: Logger
  ): Promise<T[] | null> {
    const validatedItems: T[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const dto = plainToInstance(dtoClass, rawData[i]);
      const errors = await validate(dto);

      if (errors.length > 0) {
        logger.error(`Validation failed for ${subject} item ${i}:`, errors);
        continue;
      }

      validatedItems.push(dto);
    }

    if (validatedItems.length === 0) {
      logger.warn(`No valid items in array for ${subject}`);
      return null;
    }

    return validatedItems;
  }

  private static async validateSingle<T extends object>(
    rawData: any,
    dtoClass: ClassConstructor<T>,
    subject: string,
    logger: Logger
  ): Promise<T | null> {
    const dto = plainToInstance(dtoClass, rawData);
    const errors = await validate(dto);

    if (errors.length > 0) {
      logger.error(`Validation failed for ${subject}:`, errors);
      return null;
    }

    return dto;
  }
}