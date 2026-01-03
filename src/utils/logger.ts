import pino from 'pino';
import { config } from '../config';

export const logger = pino({
  level: config.logging.level,
  transport:
    config.server.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'billing-service',
    env: config.server.nodeEnv,
  },
});

export type Logger = typeof logger;

export const createChildLogger = (context: Record<string, unknown>) => {
  return logger.child(context);
};
