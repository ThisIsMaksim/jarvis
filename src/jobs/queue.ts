import { Queue, QueueOptions, WorkerOptions } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config/env.js';
import { createChildLogger } from '../config/logger.js';

const logger = createChildLogger('queue');

// Redis connection
export const redis = new IORedis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('✅ Connected to Redis');
});

redis.on('error', (error) => {
  logger.error('❌ Redis connection error:', error);
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

// Queue options
const defaultQueueOptions: QueueOptions = {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
};

// Worker options
const defaultWorkerOptions: WorkerOptions = {
  connection: redis,
  concurrency: 5,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

// Queues
export const reminderQueue = new Queue('reminder', defaultQueueOptions);
export const summaryQueue = new Queue('summary', defaultQueueOptions);
export const llmQueue = new Queue('llm', defaultQueueOptions);

// Queue events
reminderQueue.on('error', (error) => {
  logger.error('Reminder queue error:', error);
});

summaryQueue.on('error', (error) => {
  logger.error('Summary queue error:', error);
});

llmQueue.on('error', (error) => {
  logger.error('LLM queue error:', error);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down queues...');
  
  await Promise.all([
    reminderQueue.close(),
    summaryQueue.close(),
    llmQueue.close(),
  ]);
  
  await redis.quit();
  logger.info('Queues shut down successfully');
});

export { defaultWorkerOptions };