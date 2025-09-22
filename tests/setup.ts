import { beforeAll } from 'vitest';

beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'error';
  process.env.TELEGRAM_BOT_TOKEN = 'test_token';
  process.env.MONGO_URI = 'mongodb://localhost:27017/aiassistant_test';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.OPENAI_API_KEY = 'test_openai_key';
  process.env.DEFAULT_PROVIDER = 'openai';
  process.env.DEFAULT_MODEL = 'gpt-4o-mini';
  process.env.DEFAULT_TIMEZONE = 'Europe/Berlin';
});