import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const configSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('0.0.0.0'),
    nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  }),
  database: z.object({
    url: z.string(),
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379),
    password: z.string().optional(),
  }),
  jwt: z.object({
    secret: z.string(),
    expiresIn: z.string().default('7d'),
  }),
  stripe: z.object({
    secretKey: z.string(),
    publishableKey: z.string(),
    webhookSecret: z.string(),
  }),
  ramp: z.object({
    clientId: z.string(),
    clientSecret: z.string(),
    apiBaseUrl: z.string().default('https://api.ramp.com/developer/v1'),
    webhookSecret: z.string(),
  }),
  logging: z.object({
    level: z.string().default('info'),
  }),
});

const rawConfig = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  },
  ramp: {
    clientId: process.env.RAMP_CLIENT_ID || '',
    clientSecret: process.env.RAMP_CLIENT_SECRET || '',
    apiBaseUrl: process.env.RAMP_API_BASE_URL || 'https://api.ramp.com/developer/v1',
    webhookSecret: process.env.RAMP_WEBHOOK_SECRET || '',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export const config = configSchema.parse(rawConfig);
export type Config = z.infer<typeof configSchema>;
