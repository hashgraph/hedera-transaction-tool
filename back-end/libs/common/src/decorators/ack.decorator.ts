import { RmqContext } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

export function Acked(requeue = false) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const original = descriptor.value;
    const logger = new Logger(`${target.constructor.name}.${propertyKey}`);

    descriptor.value = async function (...args: any[]) {
      // Find RmqContext-like arg (duck typing)
      const ctx: RmqContext | undefined = args.find(
        (a) => a && typeof a.getChannelRef === 'function' && typeof a.getMessage === 'function',
      );
      const channel = ctx?.getChannelRef?.();
      const msg = ctx?.getMessage?.();

      try {
        const result = await original.apply(this, args);
        if (channel && msg) {
          channel.ack(msg);
          // logger.debug('Message ACKed');
        }
        return result;
      } catch (err) {
        if (channel && msg) {
          channel.nack(msg, false, requeue);
          logger.error(`Message NACKed (requeue: ${requeue})`, err);
        }
        throw err;
      }
    };
    return descriptor;
  };
}