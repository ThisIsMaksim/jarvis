import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  // Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'Telegram bot token is required'),
  
  // Database Configuration
  MONGODB_URI: z.string().url('Invalid MongoDB URI'),
  
  // Redis Configuration
  REDIS_URL: z.string().url('Invalid Redis URL'),
  
  // AI Providers
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
  
  // Ollama Configuration
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_CHAT_MODEL: z.string().default('qwen2.5:14b-instruct'),
  OLLAMA_VISION_MODEL: z.string().default('llava:7b'),
  
  // Bot Configuration
  DEFAULT_PROVIDER: z.enum(['openai', 'gemini', 'deepseek', 'ollama']).default('openai'),
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
  const hasApiProvider = config.OPENAI_API_KEY || config.GEMINI_API_KEY || config.DEEPSEEK_API_KEY;
  const hasOllama = config.DEFAULT_PROVIDER === 'ollama';
  
  if (!hasApiProvider && !hasOllama) {
    throw new Error('At least one AI provider must be configured (API keys or Ollama)');
  }
  
  // Validate that the default provider has required configuration
  if (config.DEFAULT_PROVIDER === 'openai' && !config.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when DEFAULT_PROVIDER is set to openai');
  }
  
  if (config.DEFAULT_PROVIDER === 'gemini' && !config.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required when DEFAULT_PROVIDER is set to gemini');
  }
  
  if (config.DEFAULT_PROVIDER === 'deepseek' && !config.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required when DEFAULT_PROVIDER is set to deepseek');
  }
  
  // Ollama doesn't require API key validation as it's local
  
} catch (error) {
  console.error('❌ Invalid environment configuration:', error);
  process.exit(1);
}

export { config };