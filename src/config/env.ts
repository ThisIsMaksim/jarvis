import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  
  // Database Configuration
  MONGO_URI: z.string().url('Invalid MongoDB URI'),
  
  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL'),
  
  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  
  // Bot Configuration
  DEFAULT_PROVIDER: z.enum(['openai', 'gemini']).default('openai'),
  DEFAULT_MODEL: z.string().default('gpt-4o-mini'),
  DEFAULT_TIMEZONE: z.string().default('Europe/Berlin'),
  
  // Server Configuration
  WEBHOOK_URL: z.string().url().optional(),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('8080'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig;

try {
  config = envSchema.parse(process.env);
  
  // Validate that at least one AI provider is configured
  if (!config.OPENAI_API_KEY && !config.GEMINI_API_KEY) {
    throw new Error('At least one AI provider API key must be configured (OPENAI_API_KEY or GEMINI_API_KEY)');
  }
  
  // Validate that the default provider has an API key
  if (config.DEFAULT_PROVIDER === 'openai' && !config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when DEFAULT_PROVIDER is set to openai');
  }
  
  if (config.DEFAULT_PROVIDER === 'gemini' && !config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when DEFAULT_PROVIDER is set to gemini');
  }
  
} catch (error) {
  console.error('❌ Invalid environment configuration:', error);
  process.exit(1);
}

export { config };