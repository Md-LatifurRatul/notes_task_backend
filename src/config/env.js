import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
dotenv.config({ path: envFile, override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must contain at least 32 characters'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGIN: z.string().url().default('http://localhost:3000'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  API_DOCS_USERNAME: z.string().min(1).optional(),
  API_DOCS_PASSWORD: z.string().min(1).optional()
});

export const env = envSchema.parse(process.env);
