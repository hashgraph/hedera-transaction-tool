import { Logger } from '@nestjs/common';
import { JsMsg } from 'nats';
import { MessageValidator } from './message-validator.util';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

jest.mock('class-transformer');
jest.mock('class-validator');

class TestDto {
  id: number;
  name: string;
}

describe('MessageValidator', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockMsg: jest.Mocked<JsMsg>;

  beforeEach(() => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockMsg = {
      subject: 'test.subject',
      data: new Uint8Array(),
      ack: jest.fn(),
    } as any;

    jest.clearAllMocks();
  });

  describe('parseAndValidate', () => {
    it('should return null for empty message data', async () => {
      mockMsg.data = new TextEncoder().encode('');

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Empty message on test.subject');
    });

    it('should return null for whitespace-only message data', async () => {
      mockMsg.data = new TextEncoder().encode('   ');

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('Empty message on test.subject');
    });

    it('should validate and return a single object', async () => {
      const testData = { id: 1, name: 'test' };
      mockMsg.data = new TextEncoder().encode(JSON.stringify(testData));

      (plainToInstance as jest.Mock).mockReturnValue(testData);
      (validate as jest.Mock).mockResolvedValue([]);

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toEqual(testData);
      expect(plainToInstance).toHaveBeenCalledWith(TestDto, testData);
      expect(validate).toHaveBeenCalled();
    });

    it('should validate and return an array of objects', async () => {
      const testData = [
        { id: 1, name: 'test1' },
        { id: 2, name: 'test2' },
      ];
      mockMsg.data = new TextEncoder().encode(JSON.stringify(testData));

      (plainToInstance as jest.Mock).mockImplementation((_, data) => data);
      (validate as jest.Mock).mockResolvedValue([]);

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toEqual(testData);
      expect(plainToInstance).toHaveBeenCalledTimes(2);
      expect(validate).toHaveBeenCalledTimes(2);
    });

    it('should skip invalid items in array and return valid ones', async () => {
      const testData = [
        { id: 1, name: 'valid' },
        { id: 2, name: 'invalid' },
        { id: 3, name: 'valid' },
      ];
      mockMsg.data = new TextEncoder().encode(JSON.stringify(testData));

      (plainToInstance as jest.Mock).mockImplementation((_, data) => data);
      (validate as jest.Mock)
        .mockResolvedValueOnce([]) // valid
        .mockResolvedValueOnce([{ error: 'validation error' }]) // invalid
        .mockResolvedValueOnce([]); // valid

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toEqual([
        { id: 1, name: 'valid' },
        { id: 3, name: 'valid' },
      ]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Validation failed for test.subject item 1:',
        [{ error: 'validation error' }]
      );
    });

    it('should return null when all array items are invalid', async () => {
      const testData = [{ id: 1 }, { id: 2 }];
      mockMsg.data = new TextEncoder().encode(JSON.stringify(testData));

      (plainToInstance as jest.Mock).mockImplementation((_, data) => data);
      (validate as jest.Mock).mockResolvedValue([{ error: 'validation error' }]);

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No valid items in array for test.subject'
      );
    });

    it('should return null for invalid single object', async () => {
      const testData = { id: 1 };
      mockMsg.data = new TextEncoder().encode(JSON.stringify(testData));

      (plainToInstance as jest.Mock).mockReturnValue(testData);
      (validate as jest.Mock).mockResolvedValue([{ error: 'validation error' }]);

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Validation failed for test.subject:',
        [{ error: 'validation error' }]
      );
    });

    it('should handle JSON parse errors', async () => {
      mockMsg.data = new TextEncoder().encode('invalid json{');

      const result = await MessageValidator.parseAndValidate(
        mockMsg,
        TestDto,
        mockLogger
      );

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Parse error on test.subject'),
        expect.any(String)
      );
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Raw message data'));
    });
  });
});